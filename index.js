var Q = require('q');var Connector = require('./lib/connector');var DataClass = require('./lib/dataclass');exports.init = function (options) {	options = options || {};	var c = new Connector(options.remote);	var ds = {};		return Q.Promise(function (resolve, reject, notify) {		return c.meta(options.dataClasses).then(function (data) {			if(Array.isArray(data)){				data.forEach(function (dc) {					ds[dc.name] = new DataClass(dc, c);				});			}			resolve(ds);		});	});};