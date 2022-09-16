import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import withTags from 'sentry/utils/withTags';

describe('withTags HoC', function () {
  beforeEach(() => {
    TagStore.reset();
  });

  it('works', function () {
    const MyComponent = ({other, tags}) => {
      return (
        <div>
          <span>{other}</span>
          {tags &&
            Object.entries(tags).map(([key, tag]) => (
              <em key={key}>
                {tag.key} : {tag.name}
              </em>
            ))}
        </div>
      );
    };

    const Container = withTags(MyComponent);
    render(<Container other="value" />);

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    act(() => {
      TagStore.loadTagsSuccess([{name: 'Mechanism', key: 'mechanism', count: 1}]);
    });

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    // includes custom tags
    const renderedTag = screen.getByText('mechanism : Mechanism');
    expect(renderedTag).toBeInTheDocument();

    // excludes issue tags by default
    expect(screen.queryByText(/is\s/)).not.toBeInTheDocument();
  });
});
