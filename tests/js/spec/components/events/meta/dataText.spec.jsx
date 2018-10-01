import React from 'react';
import {shallow} from 'enzyme';

import Annotated from 'app/components/events/meta/annotated';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import DataContext from 'app/components/events/meta/dataContext';
import DataText from 'app/components/events/meta/dataText';

jest.mock('app/components/events/meta/dataContext', () => {
  let context = null;

  return {
    Consumer({children}) {
      return children(context);
    },
    setContext(next) {
      context = next;
    },
  };
});

function dive(wrapper, context) {
  DataContext.setContext(context);
  return (
    wrapper
      // 1st dive is to render DataField in DataText
      .dive()
      // 2nd dive is to render DataContext.Consumer  in DataField
      .dive()
  );
}

describe('DataText', () => {
  describe('without meta', () => {
    it('renders a string', () => {
      let wrapper = dive(shallow(<DataText />), new Annotated('foo', null));
      expect(wrapper.matchesElement('foo')).toBeTruthy();
    });

    it('renders a number', () => {
      let wrapper = dive(shallow(<DataText />), new Annotated(0, null));
      expect(wrapper.matchesElement(0)).toBeTruthy();
    });

    it('renders a boolean', () => {
      let wrapper = dive(shallow(<DataText />), new Annotated(false, null));
      expect(wrapper.matchesElement(false)).toBeTruthy();
    });

    it('wraps the content with props', () => {
      let wrapper = dive(shallow(<DataText id="id" />), new Annotated('foo', null));
      expect(wrapper.matchesElement(<span id="id">foo</span>)).toBeTruthy();
    });

    it('ignores empty meta data', () => {
      let meta = {
        err: [],
        rem: [],
        chunks: [],
      };

      let wrapper = dive(shallow(<DataText />), new Annotated('foo', {'': meta}));
      expect(wrapper.matchesElement('foo')).toBeTruthy();
    });
  });

  describe('with meta', () => {
    it('annotates errors', () => {
      let meta = {
        err: ['something'],
        rem: [],
        chunks: [],
      };

      let wrapper = dive(shallow(<DataText />), new Annotated('foo', {'': meta}));
      expect(
        wrapper.matchesElement(
          <AnnotatedText
            value="foo"
            chunks={[]}
            remarks={[]}
            errors={['something']}
            props={{}}
          />
        )
      ).toBeTruthy();
    });

    it('annotates remarks and chunks', () => {
      let meta = {
        err: [],
        rem: [{type: 't'}],
        chunks: [{text: 'foo'}],
      };

      let wrapper = dive(shallow(<DataText />), new Annotated('foo', {'': meta}));
      expect(
        wrapper.matchesElement(
          <AnnotatedText
            value="foo"
            chunks={[{text: 'foo'}]}
            remarks={[{type: 't'}]}
            errors={[]}
            props={{}}
          />
        )
      ).toBeTruthy();
    });

    it('annotates redacted text', () => {
      let meta = {
        err: ['something'],
        rem: [],
        chunks: [],
      };

      let wrapper = dive(shallow(<DataText />), new Annotated(null, {'': meta}));
      expect(
        wrapper.matchesElement(
          <AnnotatedText
            value={null}
            chunks={[]}
            remarks={[]}
            errors={['something']}
            props={{}}
          />
        )
      ).toBeTruthy();
    });

    it('passes props explicitly', () => {
      let meta = {
        err: ['something'],
        rem: [],
        chunks: [],
      };

      let wrapper = dive(
        shallow(<DataText id="bar" />),
        new Annotated('foo', {'': meta})
      );

      expect(
        wrapper.matchesElement(
          <AnnotatedText
            value="foo"
            chunks={[]}
            remarks={[]}
            errors={['something']}
            props={{id: 'bar'}}
          />
        )
      ).toBeTruthy();
    });
  });

  it('applies the callback', () => {
    let wrapper = dive(
      shallow(<DataText>{value => <span id="test" />}</DataText>),
      new Annotated('foo', null)
    );

    expect(wrapper.matchesElement(<span id="test" />)).toBeTruthy();
  });
});
