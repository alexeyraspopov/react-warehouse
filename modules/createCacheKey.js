import hashCode from './hashCode';

export default function createCacheKey(Resource, deps) {
	return deps.length > 0 ? deps.map((item) => hashCode(item)).join('/') : hashCode(Resource);
}
