import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {formatMongoDBQuery} from 'sentry/views/insights/database/utils/formatMongoDBQuery';

describe('formatMongoDBQuery', function () {
  it('correctly formats MongoDB JSON strings and can handle all primitive types', function () {
    const query =
      '{"stringKey":"test","insert":"my_collection","numericKey":7,"booleanKey":true,"nullKey":null}';

    const tokenizedQuery = formatMongoDBQuery(query, 'insert');
    render(<Fragment>{tokenizedQuery}</Fragment>);

    const boldedText = screen.getByText(/"insert": "my_collection"/i);
    expect(boldedText).toBeInTheDocument();
    // It should be bolded and correctly spaced
    expect(boldedText).toContainHTML('<b>"insert": "my_collection"</b>');

    // Get the other tokens and confirm they are not bolded
    const stringToken = screen.getByText(/"stringkey": "test"/i);
    const numericToken = screen.getByText(/"numerickey": 7/i);
    const booleanToken = screen.getByText(/"booleankey": true/i);
    const nullToken = screen.getByText(/"nullkey": null/i);

    expect(stringToken).toContainHTML('<span>"stringKey": "test"</span>');
    expect(numericToken).toContainHTML('<span>"numericKey": 7</span>');
    expect(booleanToken).toContainHTML('<span>"booleanKey": true</span>');
    expect(nullToken).toContainHTML('<span>"nullKey": null</span>');
  });

  it('correctly formats MongoDB JSON strings that includes nested objects', function () {
    const query =
      '{"objectKey":{"nestedObject":{"deeplyNested":{}}},"somethingElse":100,"find":"my_collection"}';

    const tokenizedQuery = formatMongoDBQuery(query, 'find');
    render(<Fragment>{tokenizedQuery}</Fragment>);

    const boldedText = screen.getByText(/"find": "my_collection"/i);
    expect(boldedText).toBeInTheDocument();
    // It should be bolded and correctly spaced
    expect(boldedText).toContainHTML('<b>"find": "my_collection"</b>');

    const objToken = screen.getByText(/"objectkey": \{/i);

    expect(objToken).toContainHTML(
      '<span>"objectKey": { "nestedObject": { "deeplyNested": {} } }</span>'
    );
  });

  it('correctly formats MongoDB JSON strings that include arrays', function () {
    const query =
      '{"arrayKey":[1,2,{"objInArray":{"objInObjInArray":{}}},3,4],"somethingElse":100,"delete":"my_collection"}';

    const tokenizedQuery = formatMongoDBQuery(query, 'delete');
    render(<Fragment>{tokenizedQuery}</Fragment>);

    const boldedText = screen.getByText(/"delete": "my_collection"/i);
    expect(boldedText).toBeInTheDocument();
    // It should be bolded and correctly spaced
    expect(boldedText).toContainHTML('<b>"delete": "my_collection"</b>');

    // I know this is a weird way of testing, but if something is not working, these tokens would not get rendered to begin with.
    // By confirming their presence, the test ensures that the query is correctly tokenized
    const arrayToken = screen.getByText(/"arraykey": \[/i);

    expect(arrayToken).toContainHTML(
      '<span>"arrayKey": [1, 2, { "objInArray": { "objInObjInArray": {} } }, 3, 4]</span>'
    );
  });

  it('returns an unformatted string when given invalid JSON', function () {
    const query = "{'foo': 'bar'}";
    const tokenizedQuery = formatMongoDBQuery(query, 'find');
    expect(tokenizedQuery).toEqual(query);
  });
});
