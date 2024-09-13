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
    screen.logTestingPlaygroundURL();

    const boldedText = screen.getByText(/"find": "my_collection"/i);
    expect(boldedText).toBeInTheDocument();
    // It should be bolded and correctly spaced
    expect(boldedText).toContainHTML('<b>"find": "my_collection"</b>');

    const objToken1 = screen.getByText(/"objectkey": \{/i);
    const objToken2 = screen.getByText(/"nestedobject": \{/i);
    const objToken3 = screen.getByText(/"deeplynested": \{\}/i);

    expect(objToken1).toContainHTML('<span>"objectKey": { </span>');
    expect(objToken2).toContainHTML('<span>"nestedObject": { </span>');
    expect(objToken3).toContainHTML('<span>"deeplyNested": {}</span>');
  });
});
