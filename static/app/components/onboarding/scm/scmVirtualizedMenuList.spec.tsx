import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ScmVirtualizedMenuList} from './scmVirtualizedMenuList';

// Mock the virtualizer so all rows render in JSDOM (no layout engine).
const mockScrollToIndex = jest.fn();
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({count}: {count: number}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: i * 36,
        size: 36,
      })),
    getTotalSize: () => count * 36,
    measureElement: () => {},
    scrollToIndex: mockScrollToIndex,
  }),
}));

function Heading({children}: {children?: React.ReactNode}) {
  return <div>{children}</div>;
}

// Stand-in for react-select's Group element: never rendered itself, the menu
// list reads its props and renders the extracted heading and option rows.
function Group(_props: {
  Heading: React.ComponentType<any>;
  children: React.ReactNode;
  headingProps: Record<string, unknown>;
  label: React.ReactNode;
}) {
  return null;
}

function Option({children}: {children?: React.ReactNode; data?: unknown}) {
  return <div role="option">{children}</div>;
}

const reactData = {value: 'react'};
const vueData = {value: 'vue'};
const angularData = {value: 'angular'};

const groupedChildren = [
  <Group key="group-0" Heading={Heading} headingProps={{}} label="Popular">
    {[
      <Option key="react" data={reactData}>
        React
      </Option>,
      <Option key="vue" data={vueData}>
        Vue
      </Option>,
    ]}
  </Group>,
  <Group key="group-1" Heading={Heading} headingProps={{}} label="Other platforms">
    {[
      <Option key="angular" data={angularData}>
        Angular
      </Option>,
    ]}
  </Group>,
];

describe('ScmVirtualizedMenuList', () => {
  beforeEach(() => {
    mockScrollToIndex.mockClear();
  });

  it('flattens grouped children into interleaved heading and option rows', () => {
    const {container} = render(
      <ScmVirtualizedMenuList>{groupedChildren}</ScmVirtualizedMenuList>
    );

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'React',
      'Vue',
      'Angular',
    ]);
    expect(container).toHaveTextContent('PopularReactVueOther platformsAngular');

    // The section boundary divider renders before every heading except the
    // first, so getByTestId doubles as the only-one-divider assertion.
    const divider = screen.getByTestId('menu-group-divider');
    expect(divider.nextElementSibling).toHaveTextContent('Other platforms');
  });

  it('scrolls to the focused option by its flattened row index', () => {
    render(
      <ScmVirtualizedMenuList focusedOption={angularData}>
        {groupedChildren}
      </ScmVirtualizedMenuList>
    );

    // Rows: Popular(0), React(1), Vue(2), Other platforms(3), Angular(4).
    expect(mockScrollToIndex).toHaveBeenCalledWith(4, {align: 'auto'});
  });

  it('still renders ungrouped children as one row each', () => {
    render(
      <ScmVirtualizedMenuList>
        {[
          <Option key="react" data={reactData}>
            React
          </Option>,
          <Option key="vue" data={vueData}>
            Vue
          </Option>,
        ]}
      </ScmVirtualizedMenuList>
    );

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'React',
      'Vue',
    ]);
  });
});
