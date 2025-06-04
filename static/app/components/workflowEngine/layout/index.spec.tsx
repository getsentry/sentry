import {render, screen} from 'sentry-test/reactTestingLibrary';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';

import DetailLayout from './detail';
import EditLayout from './edit';
import ListLayout from './list';

function Fixture({children}: any) {
  return (
    <SentryDocumentTitle title="title-test-value" noSuffix>
      <BreadcrumbsProvider crumb={{label: 'breadcrumb-test-value', to: '#breadcrumb'}}>
        <ActionsProvider actions={<button>action-test-value</button>}>
          {children}
        </ActionsProvider>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}

describe('Edit Layout component', function () {
  it('renders children and context values', function () {
    render(
      <Fixture>
        <EditLayout>children-test-value</EditLayout>
      </Fixture>
    );

    expect(screen.getByText('children-test-value')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'action-test-value'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'breadcrumb-test-value'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'title-test-value'})).toBeInTheDocument();
  });
});

describe('Detail Layout component', function () {
  it('renders children and context values', function () {
    render(
      <Fixture>
        <DetailLayout project={{slug: 'project-slug', platform: 'javascript-astro'}}>
          children-test-value
        </DetailLayout>
      </Fixture>
    );

    expect(screen.getByText('children-test-value')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'action-test-value'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'breadcrumb-test-value'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'title-test-value'})).toBeInTheDocument();
    // displays project badge
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('project-slug');
  });
});

describe('List Layout component', function () {
  it('renders children and context values', function () {
    render(
      <Fixture>
        <ListLayout>children-test-value</ListLayout>
      </Fixture>
    );

    expect(screen.getByText('children-test-value')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'action-test-value'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'title-test-value'})).toBeInTheDocument();
  });
});
