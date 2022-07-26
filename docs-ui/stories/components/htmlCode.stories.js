import styled from '@emotion/styled';

import HTMLCode from 'sentry/components/htmlCode';

export default {
  title: 'Components/HTML Code',
  component: HTMLCode,
};

export const Default = () => (
  <Wrapper>
    <HTMLCode
      code={`<div data-reactroot=""><div class="row"><form action="/validate"><div class="col-md-10 form-group"><input type="text" class="form-control" name="url" value="" placeholder="http://code.jquery.com/jquery-1.9.1.min.js" title="Fully qualified URL prefixed with http or https" pattern="https?://.+"></div><div class="col-md-2"><button class="btn btn-default">Validate</button></div></form></div><h2>Examples</h2><ul><li><a href="http://underscorejs.org/underscore-min.js"><!-- react-text: 12 -->Underscore.js<!-- /react-text --><!-- react-text: 13 --> (<!-- /react-text --><!-- react-text: 14 -->1.8.3<!-- /react-text --><!-- react-text: 15 -->)<!-- /react-text --></a></li><li><a href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"><!-- react-text: 18 -->Bootstrap.js<!-- /react-text --><!-- react-text: 19 --> (<!-- /react-text --><!-- react-text: 20 -->3.3.7<!-- /react-text --><!-- react-text: 21 -->)<!-- /react-text --></a></li><li><a href="https://cdn.ravenjs.com/3.17.0/raven.min.js"><!-- react-text: 24 -->Raven.js<!-- /react-text --><!-- react-text: 25 --> (<!-- /react-text --><!-- react-text: 26 -->3.17.0<!-- /react-text --><!-- react-text: 27 -->)<!-- /react-text --></a></li><li><a href="https://ajax.googleapis.com/ajax/libs/angularjs/1.5.6/angular.min.js"><!-- react-text: 30 -->AngularJS<!-- /react-text --><!-- react-text: 31 --> (<!-- /react-text --><!-- react-text: 32 -->1.5.6<!-- /react-text --><!-- react-text: 33 -->)<!-- /react-text --></a></li></ul></div>`}
    />
  </Wrapper>
);

Default.storyName = 'HTML Code';

const Wrapper = styled('div')`
  display: block;
`;
