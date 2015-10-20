var Model = require('./model');
var Collection = require('./collection');
var Connector = require('./connector');

function DataClass(meta, c) {
	Object.defineProperty(this, 'connector', {
		get: function() {
			return _connector;
		},
		set: function(value) {
			if (value instanceof Connector) {
				_connector = value;
			}
		},
		enumerable: false,
		configurable: false
	});

	var that = this,
		_connector;
	this.meta = meta;
	this.name = meta.name;
	this.connector = c;

	var modelObj = {
		dataclass: this,
		connector: c
	};
	var colObj = {
		dataclass: this,
		connector: c
	};

	if (Array.isArray(meta.methods)) {
		meta.methods.forEach(function(method) {
			var applyTo = that;

			switch (method.applyTo) {
				case 'entity':
					applyTo = modelObj;
					break;
				case 'entityCollection':
					applyTo = colObj;
					break;
			}

			applyTo[method.name] = function() {
				return c.execMethod(that.getName(), this, method.name, Array.prototype.slice.call(arguments, 0));
			};
		});
	}

	// Init the attributes
	if (Array.isArray(that.meta.attributes)) {
		modelObj.initialize = function() {
			var self = this;

			that.meta.attributes.forEach(function(attribute) {
				if (attribute.kind === 'relatedEntities' || attribute.kind == 'relatedEntity') {
					console.log('Related attributes not yet supported!');
					return;
				}

				Object.defineProperty(self, attribute.name, {
					get: function() {
						return this.get(attribute.name);
					},
					set: function(value) {
						this.set(attribute.name, value);
					},
					enumerable: false,
					configurable: false
				});
			});

			Model.prototype.initialize.apply(this, arguments);
		};
	}

	this.Model = Model.extend(modelObj);

	colObj.model = this.Model;
	this.Collection = Collection.extend(colObj);
};

function callCollectionMethod(method, args) {
	var col;

	if (!this.collection) {
		col = this.collection = this.createEntityCollection();
	} else {
		col = this.collection;
		col.__KEY = null;
	}

	return col[method].apply(col, args);
}

var methods = ["all", "average", "compute", "count", "distinctValues", "find", "query", "first", "forEach", "fromArray", "getName", "max", "min", "orderBy", "remove", "sum", "toArray"];
methods.forEach(function(method) {
	DataClass.prototype[method] = function() {
		return callCollectionMethod.call(this, method, arguments);
	};
});

DataClass.prototype.createEntity = function(params) {
	if (!this.Model) {
		throw 'The dataclass not initialized!';
		return;
	}

	return new this.Model(params);
};

DataClass.prototype.createEntityCollection = function() {
	if (!this.Collection) {
		throw 'The dataclass not initialized!';
		return;
	}

	return new this.Collection();
};

DataClass.prototype.getName = function() {
	return this.name;
};

module.exports = DataClass;