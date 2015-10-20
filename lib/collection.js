var B = require('backbone');
var Model = require('./model');
var utils = require('./utils');
var Q = require('q');
var async = require('async');

var params = ["$expand", "$distinct", "$filter", "$method", "$orderby", "$querypath", "$queryplan", "$savedfilter", "$savedorderby", "$skip", "$timeout", "$top", "$limit", "$compute"];
var defauls = {
	$queryplan: true,
	$querypath: true,
	$top: 40
};
var obj = {
	__COUNT: null,
	__KEY: null,
	__FIRST: 0,
	__SENT: 0,
	__queryPath: null,
	__queryPlan: null,
	dataclass: null,
	model: Model,
	initialize: function() {
		utils.initialize.apply(this, arguments);

		this.on({
			"add": function(model, collection, options) {
				model.__TIMESTAMP = new Date();
			}
		});

		var calculated = ['queryPath', 'queryPlan'];
		var that = this;

		calculated.forEach(function(item, index) {
			Object.defineProperty(that, item, {
				get: function() {
					return that['__' + item];
				},
				enumerable: false,
				configurable: false
			});
		});

		this.initParams();
	},
	getDataClass: function() {
		return this.dataclass;
	},
	sync: function(method, model, options) {
		options = options || {};
		var optsParam = options.params = options.params || {};

		for (var i = params.length - 1, param; param = params[i]; i--) {
			if (optsParam.hasOwnProperty(param)) {
				options.params[param] = optsParam[param];
			} else if (model[param] != null) {
				options.params[param] = model[param];
			}
		}

		return this.connector.sync.apply(this.connector, arguments);
	},
	fetch: function() {
		this.__KEY = null;
		return this.sync('read', this, {
			params: {
				$method: 'entityset'
			}
		});
	},
	distinctValues: function(attribute) {
		return this.sync('read', this, {
			subresource: attribute,
			params: {
				$distinct: true
			}
		});
	},
	pluck: function(attribute) {
		return this.distinctValues(attribute);
	},
	forEach: function(fn) {
		if (typeof fn !== 'function') {
			return;
		}

		var that = this;

		return Q.Promise(function(resolve, reject) {
			debugger;
			async.doWhilst(
				function(callback) {
					that.more().then(function() {
						for (var i = 0; i < that.length; i++) {
							var entity = that.at(i);
							fn.call(entity, entity);
						}
						callback(null);
					});
				},
				that.hasMore.bind(that),
				function(err) {
					if (err) {
						return reject(err);
					}

					resolve(that);
				}
			);
		});
	},
	count: function(attrs, distinct) {
		return this.compute.call(this, attrs, distinct, 'count');
	},
	average: function(attrs, distinct) {
		return this.compute.call(this, attrs, distinct, 'average');
	},
	min: function(attrs, distinct) {
		return this.compute.call(this, attrs, distinct, 'min');
	},
	max: function(attrs, distinct) {
		return this.compute.call(this, attrs, distinct, 'max');
	},
	sum: function(attrs, distinct) {
		return this.compute.call(this, attrs, distinct, 'sum');
	},
	compute: function(attrs, distinct, type) {
		var params = {
			$compute: type ? type : '$all'
		};
		if (distinct === true || distinct === 'true') {
			params.$distinct = true;
		}
		var res = this.sync('read', this, {
			subresource: attrs,
			params: params
		});
		this.initParams();
		return res;
	},
	first: function() {
		var that = this;
		return Q.promise(function(resolve, reject) {
			if (that.__FIRST != 0 || that.length == 0) {
				return that.sync('read', that, {
					params: {
						$top: 1
					}
				}).then(function() {
					resolve(that.at(0));
				});
			}

			resolve(that.at(0));
		});
	},
	all: function() {
		var that = this;
		this.__KEY = null;

		return that.sync('read', that, {
			params: {}
		});
	},
	find: function(request) {
		if (!request) {
			return this.first();
		}

		var params = {};
		var reqStr = '';
		var that = this;

		switch (true) {
			case typeof request === 'string':
				reqStr = request;
				break;
			case typeof request === 'object':
				var first = true;

				for (var attr in request) {
					if (first) {
						first = false
					} else {
						reqStr += ' && ';
					}
					reqStr += attr + '=' + request[attr];
				}

				break;
		}

		return Q.promise(function(resolve, reject) {
			that.sync('read', that, {
				params: {
					$top: 1,
					$filter: reqStr
				}
			}).then(function() {
				resolve(that.at(0));
			});
		});
	},
	query: function(request) {
		if (!request) {
			this.fetch();
			return this;
		}

		var params = {};
		var reqStr = '';
		var args = [];

		switch (true) {
			case typeof request === 'string':
				reqStr = request;

				for (var i = 1; i < arguments.length; i++) {
					args.push(arguments[i]);
				}

				break;
			case typeof request === 'object':
				var first = true;

				for (var attr in request) {
					if (first) {
						first = false
					} else {
						reqStr += ' && ';
					}
					reqStr += attr + '==' + request[attr];
				}

				break;
		}

		params.$filter = reqStr;
		params.$method = 'entityset';

		if (args.length) {
			params.$params = JSON.stringify(args);
		}

		return this.sync('read', this, {
			params: params
		});
	},
	orderBy: function(request) {
		return this.sync('read', this, {
			params: {
				$orderby: request
			}
		});
	},
	remove: function() {
		return this.sync('read', this, {
			params: {
				$method: 'delete'
			}
		});
	},
	toArray: function(attrs) {
		var that = this;
		var params = {
			$asArray: true
		};

		if (typeof attrs === 'string') {
			params.$expand = attrs;
		}

		params.$top = null;

		return this.sync('read', this, {
			params: params
		});
	},
	initParams: function() {
		for (var i = params.length - 1, param; param = params[i]; i--) {
			if (defauls.hasOwnProperty(param)) {
				this[param] = defauls[param];
			} else {
				this[param] = null;
			}
		}
	},
	setDefault: function(key, value) {
		defauls[key] = value;
	},
	more: function() {
		return this.sync('read', this, {
			params: {
				$skip: this.__FIRST + this.__SENT
			}
		});
	},
	hasMore: function() {
		return this.__COUNT === null || this.__FIRST + this.__SENT < this.__COUNT;
	}
};

module.exports = B.Collection.extend(obj);