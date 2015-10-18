# Wakanda connecor for NodeJS
## Quick start example:
The initializer returns a Promise (see [Q](https://github.com/kriskowal/q) for more information)
```js
var wakanda = require('');
var promise = wakanda.init({
	remote: {
		host: 'localhost',
		port: '8081',
		secure: false
	},
	dataClasses: ['Employee'] // null, undefined or '' to load all dataclasses
});
```

Then we can call some methods:
```js
// Get the first entity, edit it and save it:
promise.then(function(ds){
    ds.Employee.first().then(function(emp){
        if(emp){
            emp.firstname = 'Martin';
            emp.save();
        }
    });
})
```
