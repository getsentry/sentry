import {queryToObj} from "app/utils/stream";

describe("utils/stream", function () {
	describe("queryToObj()", function () {
		it("should convert a basic query string to a query object", function () {
			expect(queryToObj('is:unresolved')).to.eql({
				is: 'unresolved'
			});

			expect(queryToObj('is:unresolved browser:"Chrome 36"')).to.eql({
				is: 'unresolved',
				browser: 'Chrome 36'
			});

			expect(queryToObj('python is:unresolved browser:"Chrome 36"')).to.eql({
				__text: 'python',
				is: 'unresolved',
				browser: 'Chrome 36'
			});
		});

		it('should convert separate query tokens into a single __text property', function () {
			expect(queryToObj('python    exception')).to.eql({
				__text: 'python exception'
			});

			// NOTE: "python exception" is extracted despite being broken up by "is:unresolved"
			expect(queryToObj('python  is:unresolved exception')).to.eql({
				__text: 'python exception',
				is: 'unresolved'
			});
		});
	});
});