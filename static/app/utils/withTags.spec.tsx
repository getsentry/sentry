import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import {TagCollection} from 'sentry/types';
import withTags from 'sentry/utils/withTags';

interface TestComponentProps {
  tags: TagCollection;
  other?: string;
}

function TestComponent({other, tags}: TestComponentProps) {
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
}

describe('withTags HoC', function () {
  beforeEach(() => {
    TagStore.reset();
  });

  it('works', function () {
    const Container = withTags(TestComponent);
    render(<Container other="value" />);

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    act(() => {
      TagStore.loadTagsSuccess([{name: 'Mechanism', key: 'mechanism', totalValues: 1}]);
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
