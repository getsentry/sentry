import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';
import {findAllByTextContent} from 'sentry-test/utils';

import Breadcrumbs from 'app/components/events/interfaces/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'app/types/breadcrumbs';
import {EntryType} from 'app/types/event';

describe('Breadcrumbs', () => {
  let props: React.ComponentProps<typeof Breadcrumbs>;
  const {router} = initializeOrg();

  beforeEach(() => {
    props = {
      route: {},
      router,
      // @ts-expect-error
      organization: TestStubs.Organization(),
      // @ts-expect-error
      event: TestStubs.Event({entries: []}),
      type: EntryType.BREADCRUMBS,
      data: {
        values: [
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'hey',
            category: 'error',
            level: BreadcrumbLevelType.INFO,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'hello',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'bye',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'ok',
            category: 'error',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.WARNING,
            type: BreadcrumbType.INFO,
          },
          {
            message: 'sup',
            category: 'default',
            level: BreadcrumbLevelType.INFO,
            type: BreadcrumbType.INFO,
          },
        ],
      },
    };
  });

  describe('filterCrumbs', function () {
    it('should filter crumbs based on crumb message', async function () {
      const component = mountWithTheme(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      fireEvent.change(searchInput, {target: {value: 'hi'}});

      expect(
        await screen.findByText('Sorry, no breadcrumbs match your search query')
      ).toBeInTheDocument();

      fireEvent.change(searchInput, {target: {value: 'up'}});

      expect(
        screen.queryByText('Sorry, no breadcrumbs match your search query')
      ).not.toBeInTheDocument();

      expect(await findAllByTextContent(component, 'sup')).toHaveLength(3);
    });

    it('should filter crumbs based on crumb level', async function () {
      const component = mountWithTheme(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      fireEvent.change(searchInput, {target: {value: 'war'}});

      // breadcrumbs + filter item
      // TODO(Priscila): Filter should not render in the dom if not open
      expect(await findAllByTextContent(component, 'Warning')).toHaveLength(6);
    });

    it('should filter crumbs based on crumb category', async function () {
      const component = mountWithTheme(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      fireEvent.change(searchInput, {target: {value: 'error'}});

      expect(await findAllByTextContent(component, 'error')).toHaveLength(2);
    });
  });

  describe('render', function () {
    it('should display the correct number of crumbs with no filter', function () {
      props.data.values = props.data.values.slice(0, 4);

      mountWithTheme(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(screen.getAllByTestId('crumb')).toHaveLength(4);

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should display the correct number of crumbs with a filter', function () {
      props.data.values = props.data.values.slice(0, 4);

      mountWithTheme(<Breadcrumbs {...props} />);

      const searchInput = screen.getByPlaceholderText('Search breadcrumbs');

      fireEvent.change(searchInput, {target: {value: 'sup'}});

      expect(screen.queryByTestId('crumb')).not.toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });

    it('should not crash if data contains a toString attribute', function () {
      // Regression test: A "toString" property in data should not falsely be
      // used to coerce breadcrumb data to string. This would cause a TypeError.
      const data = {nested: {toString: 'hello'}};

      props.data.values = [
        {
          message: 'sup',
          category: 'default',
          level: BreadcrumbLevelType.INFO,
          type: BreadcrumbType.INFO,
          data,
        },
      ];

      mountWithTheme(<Breadcrumbs {...props} />);

      // data.values + virtual crumb
      expect(screen.getByTestId('crumb')).toBeInTheDocument();

      expect(screen.getByTestId('last-crumb')).toBeInTheDocument();
    });
  });
});
