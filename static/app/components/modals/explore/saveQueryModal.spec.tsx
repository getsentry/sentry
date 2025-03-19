import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import SaveQueryModal from 'sentry/components/modals/explore/saveQueryModal';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

describe('SaveQueryModal', function () {
  let initialData!: ReturnType<typeof initializeOrg>;

  beforeEach(() => {
    initialData = initializeOrg();
  });

  it('should render', function () {
    const saveQuery = jest.fn();
    render(
      <SaveQueryModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => {}}
        organization={initialData.organization}
        query={'span.op:pageload'}
        visualizes={[
          {
            chartType: 1,
            yAxes: ['avg(span.duration)'],
            label: 'A',
          },
        ]}
        groupBys={['span.op']}
        saveQuery={saveQuery}
      />
    );

    expect(screen.getByText('Create a New Query')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('pageload')).toBeInTheDocument();
    expect(screen.getByText('Visualize')).toBeInTheDocument();
    expect(screen.getByText('avg(span.duration)')).toBeInTheDocument();
    expect(screen.getByText('Group By')).toBeInTheDocument();
    expect(screen.getAllByText('span.op')).toHaveLength(2);
  });

  it('should call saveQuery', async function () {
    const saveQuery = jest.fn();
    render(
      <SaveQueryModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => {}}
        organization={initialData.organization}
        query={'span.op:pageload'}
        visualizes={[
          {
            chartType: 1,
            yAxes: ['avg(span.duration)'],
            label: 'A',
          },
        ]}
        groupBys={[]}
        saveQuery={saveQuery}
      />
    );

    await userEvent.type(screen.getByTitle('Enter a name for your saved query'), 'test');

    await userEvent.click(screen.getByLabelText('Create a New Query'));

    await waitFor(() => expect(saveQuery).toHaveBeenCalled());
  });
});
