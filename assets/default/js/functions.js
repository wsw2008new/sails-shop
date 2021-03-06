/* JS FUNCTIONS */
$(function(){
  
  //SETTINGS FORM AJAX
  $(".ajaxForm").submit(function(event) {
      event.preventDefault();
      $.ajax({
        url: $(this).attr('action'),
        type: $(this).attr('method'),
        data: $(this).serialize(),
        success: function(dat) {
          window.location.replace($(".ajaxForm").data('redirect'));
        }
      });
  });
    $('.ajaxDelete').click(function(){
        var r = confirm("Are you sure?");
        if(r){
          $.ajax({
            url: '/'+$(this).data('model')+'/'+$(this).attr('id'),
            type: 'DELETE',
            success: function(data) {
              window.location.replace("/admin/"+$('.ajaxDelete').data('model'));
            }
          });
        }
    });

});


function addOption(){
  $('.options').append('<div class="row op"><div class="col-sm-7"><input type="text" name="oname" class="form-control col-sm-3" placeholder="Option" required></div><div class="col-sm-3"><input type="number" name="ostock" class="form-control" placeholder="Stock" value="0" min="0" required></div><div class="col-sm-2"><a href="javascript:void(0)" onclick="removeOption(this)" class="btn btn-danger btn-block"><i class="glyphicon glyphicon-trash"></i></a></div></div>');
  disableStock();
}

function disableStock(){
  //$('#stockProduct').val(0);
  //$('#stockProduct').prop('disabled', true);
}
function enableStock(){
  //if($('.op').length < 1)
    //$('#stockProduct').prop('disabled', false);
    
}

function removeOption(e){
  $(e).parent().parent().remove();
  enableStock();
}

AsyncForEach = function (array, fn, callback) {
    array = array.slice(0);
    var counter=-1;
    function processOne() {
        var item = array.pop();
        counter++;
        fn(item, counter, function(result) {
            if(array.length > 0) {
                setTimeout(processOne, 0);
            } else {
                callback();
            }
        });
    }
    if(array.length > 0) {
        setTimeout(processOne, 0);
    } else {
        callback();
    }
};

var sailsShop = angular.module('sailsShop', ['ngMessages']);

sailsShop.factory('ngCart', function($rootScope){

    io.socket.on('addItem', function  (data) {
        cart.items.push(data.item);
        cart.recalculeItemsInCart();
    });

    io.socket.on('removeItem', function  (data) {
        var result = $.grep(cart.items, function(e){ return e.id == data.id; });
        if (result.length > 0) {
            var index = cart.items.indexOf(result[0]);
            cart.items.splice(index, 1);
            cart.recalculeItemsInCart();
        }
    });

    io.socket.on('saveItem', function  (data) {
        var result = $.grep(cart.items, function(e){ return e.id == data.item.id; });
        if (result.length > 0) {
            var index = cart.items.indexOf(result[0]);
            cart.items[index].qty = parseInt(data.item.qty);
            cart.recalculeItemsInCart();
        } 
    });

    var cart = {
        amount : 0,
        count : 0,
        shipping: 0,
        items : [],

        addItem: function (id, quantity, option){
            var _self = this;
            if (quantity == undefined) { quantity = 1; }
            io.socket.post("/cart", {product: id, qty: quantity, option: option}, function (data, jwres){
            });
        },
        removeItems: function (items){
            var _self = this;
            items.forEach(function(item){
                _self.removeItem(item);
            });
        },
        removeItem: function (item) {
            var _self = this;
            var index = _self.items.indexOf(item);
            io.socket.delete("/cart", {id: _self.items[index].id}, function (data, jwres){
            });
        },

        removeItemByIndex: function (index) {
            var _self = this;
             _self.removeItem(_self.items[index]);
        },

        saveItem: function (index){
            var _self = this;
            io.socket.put("/cart/" +  _self.items[index].id, {qty:  parseInt(_self.items[index].qty)}, function (data, jwres){
            })
        },

        inCart: function (productID) {
            var _self = this;
            return $.grep(_self.items, function(e){ return e.product.id == productID; });
        },

        recalculeItemsInCart: function (){
            var _self = this;
            var total = 0;
            var totalOrder = 0;
            AsyncForEach(_self.items, 
                function(item, index, next){
                    if ( parseFloat(item.product.shipping) > parseFloat(_self.shipping) ) _self.shipping = parseFloat(item.product.shipping);
                    total += parseInt(item.qty);
                    totalOrder += parseInt(item.qty) * item.product.price;
                    next();
                }, 
                function (){
                    _self.count = total;
                    _self.amount = totalOrder;
                    $rootScope.$broadcast('scope:refresh', {});
            });
        }
    };
    

    var reload = function (){
        var _self = this;
        io.socket.get("/cart", function (data, jwres){
            AsyncForEach (data, function(item, index, next){
                item.qty = parseInt(item.qty);
                cart.items.push(item);
                next();
            }, function(){
                cart.recalculeItemsInCart();
            })
        });
    }

    reload();
    return cart;
});

sailsShop.factory('ngProduct', function($rootScope){
    var product = {
        info: {},
        load : function (code){
            var self = this;
            io.socket.post("/product/" + code, function (data, jwres){
                self.info = data;
                $rootScope.$broadcast('scope:refresh', {});
            })
        },
        myFilterOption: function (item) { 
            var sold = item.sold != undefined ? parseInt(item.sold) : 0;
            var realStock = parseInt(item.stock) - sold;
            if ( realStock > 0 ){
               return true;
            }
            return false;
        }
    };

    io.socket.on('infoProduct', function  (data) {
        
        if (product.info.id == data.id) {
            product.info = data;
            $rootScope.$broadcast('scope:refresh', {});
        }
    });

    return product;
});

sailsShop.directive('ngProduct', function (ngProduct){
    return {
        link: function (scope, element, attr) {
            var code = attr.ngProduct;
            ngProduct.load(code);
        } 
    }
});

sailsShop.controller('shopController', function ($scope, ngCart, ngProduct, $rootScope) {
    $scope.cart = ngCart;
    $scope.product = ngProduct;

    $rootScope.$on('scope:refresh', function () {
        $scope.$apply();
    });

    $scope.payment = function (method) {
        if (!$scope.checkout) $scope.checkout = {};
        if  (!$scope.checkout.submited) {
            $scope.checkout.submited = true;
        }
        if ( !$scope.userForm.name.$invalid && !$scope.userForm.email.$invalid && !$scope.userForm.address.$invalid && !$scope.userForm.cp.$invalid && !$scope.userForm.surname.$invalid && !$scope.userForm.phone.$invalid && !$scope.userForm.city.$invalid && !$scope.userForm.country.$invalid) {
            $scope.checkout.submited = false; 
            $scope.checkout.method = method;
            $scope.messageInfo = "Payment in process, please wait...";
            io.socket.post("/payment", { data: $scope.checkout }, function (data, jwres){
                if (data.error) {
                    $scope.message = data.error;
                    $(".alert-danger").fadeTo(3000, 500).slideUp(500, function() {
                        $(".alert-danger").alert('close');
                        $scope.checkout.method = undefined;
                        $scope.$apply();
                    });
                }else{
                    if (data.redirect){
                        window.location.href = data.redirect;
                    }else if (data.form){
                        var e = document.createElement('div');
                        e.innerHTML = data.form;
                        document.body.appendChild(e);
                        console.log(data.form);
                        document.forms["redsys_form"].submit();
                    } else {
                        console.log(data);
                    }
                }
                $scope.$apply();
            });
        }

    };
});



