exports.initialize = function () {
	var DataClass = require('./dataclass');
	
	if(this.collection){
		this.dataclass = this.collection.dataclass;
	}

	if(!this.dataclass || !( this.dataclass instanceof DataClass )){
		throw 'Invalid dataclass type!';
		return false;
	}
};