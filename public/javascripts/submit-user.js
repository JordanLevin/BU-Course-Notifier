// /**
//  * Created by jordan on 2/26/17.
//  */
// $(document).ready(function()
// {
//     $('#new-user-form').on('submit', function (e) {
//         e.preventDefault();
//         $.ajax({
//             url: '/create-account', //this is the submit URL
//             type: 'POST', //or POST
//             data: $('#new-user-form').serialize(),
//             success: function (data) {
//                 //dismisses modal
//                 $('#myModal').modal('toggle');
//             }
//         });
//
//     });
//     $('#sign-in-form').on('submit', function (e) {
//         console.log("test");
//         e.preventDefault();
//         $.ajax({
//             //console.log("test");
//             url: '/login', //this is the submit URL
//             type: 'POST', //or POST
//             data: $('#sign-in-form').serialize(),
//             success: function (data) {
//
//                 //dismisses modal
//                 $('#sign-in').modal('toggle');
//             }
//         });
//
//     });
// });