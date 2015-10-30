var B = require('backbone');
var Q = require('q');
var http = require('http');
var https = require('https');

var METHODS = {
	'GET': 'GET',
	'POST': 'POST',
	'PUT': 'POST',
	'DELETE': 'GET'
};

var HttpError = function(status, message) {
	this.error = status;
	this.message = message;
};

var Connector = function(options) {
	options = options && typeof options === 'object' ? options : {};
	this.secure = options.secure;
	this.port = options.port ? options.port : (options.secure ? '443' : '80');
	this.urlRoot = options.urlRoot ? options.urlRoot : '/rest/';
	this.host = options.host ? options.host : 'localhost';
};

Connector.prototype.url = function(dcName, type, method, options) {
	var url = this.urlRoot + dcName;

	var subresource = options && options.subresource ? options.subresource : null;

	options = options || {};

	if (type === 'entity' && options && options.__KEY) {
		url += '(' + options.__KEY + ')';
	}

	if (subresource) {

		switch (true) {

			case typeof subresource === 'string':

				url += '/' + subresource;
				break;

			case Array.isArray(subresource):

				for (var i = 0, subrc; subrc = subresource[i]; i++) {

					if (i == 0) {
						url += '/';
					} else if (i < subresource.length - 1) {
						url += ',';
					}

					url += subrc;
				}

				break;

		}

	}

	if (type === 'collection' && options && options.__KEY) {
		url += '/$entityset/' + options.__KEY;
	}

	if (typeof method === 'string') {
		url += '/' + method;
	}

	if (options && options.params) {
		var first = true;

		for (var attr in options.params) {
			if ([undefined, '', null].indexOf(options.params[attr]) >= 0) {
				continue;
			}

			if (first) {
				url += '?';
				first = false;
			} else {
				url += '&';
			}

			if (typeof options.params[attr] === 'string') {
				options.params[attr] = encodeURI(options.params[attr]);
			}

			url += attr + "='" + options.params[attr] + "'";
		}
	}

	return url;
};

Connector.prototype.sync = function(method, model, options) {
	var url;
	var httpMethod = METHODS.GET;
	var deferred = Q.defer();
	var dcName = model.getDataClass().getName();
	var httpBody;

	options = options || {};

	// Construct the request
	switch (true) {
		case model instanceof B.Model:

			httpBody = model.toJSON();

			switch (method) {
				case 'create':
				case 'update':
					url = this.url(dcName, 'entity', null, {
						params: {
							'$method': 'update'
						}
					});

					if (method === 'create') {
						httpMethod = METHODS.POST;
						httpBody.__ISNEW = true;
					} else {
						httpMethod = METHODS.PUT;
					}

					if (options && options.send === false) {
						return;
					}

					break;
				case 'delete':
					url = this.url(dcName, 'entity', null, {
						__KEY: model.getKey(),
						params: {
							'$method': 'delete'
						}
					});
					httpMethod = METHODS.DELETE;
					break;
				case 'read':
					url = this.url(dcName, 'entity', null, {
						__KEY: model.getKey()
					});
					break;
			}

			if ([METHODS.GET, METHODS.DELETE].indexOf(httpMethod) >= 0) {
				httpBody = null;
			} else {
				httpBody = {
					__ENTITIES: httpBody
				};
			}

			break;

		case model instanceof B.Collection:
			switch (method) {
				case 'read':
					if (model.__KEY)
						options.__KEY = model.__KEY;

					url = this.url(dcName, 'collection', null, options);
					break;
			}

			break;
	}

	var reqOpts = {
		host: this.host,
		port: this.port ? this.port : (this.secure ? '443' : '80'),
		path: url,
		method: httpMethod,
		headers: {
			'Content-Type': 'application/json'
		}
	};

	if (httpBody) {
		httpBody = JSON.stringify(httpBody);
		reqOpts.headers['Content-Length'] = httpBody.length;
	}
	
	var request = (this.secure ? https : http).request(reqOpts, function(res) {
		res.setEncoding('utf8');
		
		var buffer = '';
		
		res.on('data', function(chunk) {
			buffer += chunk;
		});
		
		res.on('end', function () {
			var result;
			var jsonResp = JSON.parse(buffer);

			if (typeof jsonResp === 'object' && jsonResp && jsonResp.hasOwnProperty('__ERROR')) {
				return deferred.reject(jsonResp);
			}

			// Update the model
			switch (true) {
				case model instanceof B.Model:
					if (Object.prototype.toString.call(jsonResp) !== '[object Object]') {
						result = jsonResp;
						break;
					}

					for (var attr in jsonResp) {
						if (attr === "ok") {
							result = jsonResp[attr];
							break;
						}

						if (attr === "__entityModel") {
							continue;
						}

						if (attr === "uri") {
							continue;
						}

						if (attr === "__ENTITIES") {
							result = jsonResp[attr][0];
							delete result.uri;
							model.set(result);
							continue;
						}
					}
					break;

				case model instanceof B.Collection:
					if (Object.prototype.toString.call(jsonResp) !== '[object Object]') {
						result = jsonResp;
						break;
					}

					for (var attr in jsonResp) {
						if (attr === "__ENTITYSET" && /\/\$entityset\/(.*)$/.test(jsonResp[attr])) {
							model.__KEY = /\/\$entityset\/(.*)$/.exec(jsonResp[attr])[1];
							continue;
						}

						if (attr === "__ENTITIES") {
							model.reset(jsonResp[attr]);
							result = model;
							continue;
						}

						if (attr === "ok") {
							result = jsonResp[attr];
							break;
						}

						if (attr === "__entityModel") {
							dcName = jsonResp[attr];
							continue;
						}

						model[attr] = jsonResp[attr];
					}
					break;
			}

			deferred.resolve(result);
		})
		res.on('error', function(chunk) {
			deferred.reject(chunk);
		});
	});

	if (httpBody) {
		request.write(httpBody);
	}

	request.end();

	return deferred.promise;
};

Connector.prototype.meta = function(dcNames) {
	var that = this;

	dcNames = dcNames || '$all';

	if (Array.isArray(dcNames)) {
		dcNames = dcNames.join(',');
	}

	return Q.Promise(function(resolve, reject, notify) {
		var request = http.request({
			host: that.host,
			port: that.port ? that.port : (that.secure ? '443' : '80'),
			path: that.urlRoot + '$catalog/' + dcNames
		}, function(res) {
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				var jsonResp = JSON.parse(chunk);

				if (typeof jsonResp === 'object' && jsonResp && jsonResp.hasOwnProperty('__ERROR')) {
					return reject(jsonResp);
				}

				if (!jsonResp.hasOwnProperty('dataClasses') || !Array.isArray(jsonResp.dataClasses) || jsonResp.dataClasses.length == 0) {
					return reject('Invalid server response!');
				}

				resolve(jsonResp.dataClasses);
			});
		}).end();
	});
};

Connector.prototype.execMethod = function(dcName, model, methodName, args) {
	var url;
	var options = {};
	var deferred = Q.defer();

	switch (true) {
		case model instanceof B.Model:
			if (model.get('__KEY'))
				options.__KEY = model.getKey();

			url = this.url(dcName, 'entity', methodName, options);
			break;
		case model instanceof B.Collection:
			if (model.__KEY)
				options.__KEY = model.__KEY;

			url = this.url(dcName, 'collection', methodName, options);
			break;
		default:
			url = (this.secure ? 'https' : 'http') + '://' +
				this.host + ':' + this.port +
				this.urlRoot + dcName + '/' + methodName;
			break;
	}

	if (!url) {
		return deferred.reject('Invalid url');
	}

	var request = (this.secure ? https : http).request({
		host: this.host,
		port: this.port ? this.port : (this.secure ? '443' : '80'),
		path: url,
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'content-length': JSON.stringify(args).length
		}
	}, function(res) {
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			var jsonResp = JSON.parse(chunk);

			if (typeof jsonResp === 'object' && jsonResp && jsonResp.hasOwnProperty('__ERROR')) {
				return deferred.reject(jsonResp);
			}

			if (!jsonResp.hasOwnProperty('result')) {
				return deferred.reject('Invalid server response!');
			}

			deferred.resolve(jsonResp.result);
		});
	});

	request.write(JSON.stringify(args));
	request.end();

	return deferred.promise;
};

module.exports = Connector;