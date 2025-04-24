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
        saveQuery={saveQuery}
      />
    );

    expect(screen.getByText('Create a New Query')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Starred')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Starred'})).toBeInTheDocument();
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
        saveQuery={saveQuery}
      />
    );

    await userEvent.type(
      screen.getByTitle('Enter a name for your new query'),
      'Query Name'
    );

    await userEvent.click(screen.getByLabelText('Create a New Query'));

    await waitFor(() => expect(saveQuery).toHaveBeenCalledWith('Query Name', true));
  });

  it('should call saveQuery without starring the query', async function () {
    const saveQuery = jest.fn();
    render(
      <SaveQueryModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => {}}
        organization={initialData.organization}
        saveQuery={saveQuery}
      />
    );

    await userEvent.type(
      screen.getByTitle('Enter a name for your new query'),
      'Query Name'
    );
    await userEvent.click(screen.getByRole('checkbox', {name: 'Starred'}));

    await userEvent.click(screen.getByLabelText('Create a New Query'));

    await waitFor(() => expect(saveQuery).toHaveBeenCalledWith('Query Name', false));
  });

  it('should render rename ui', function () {
    const saveQuery = jest.fn();
    render(
      <SaveQueryModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => {}}
        organization={initialData.organization}
        saveQuery={saveQuery}
        name="Initial Query Name"
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue('Initial Query Name');
    expect(screen.getByText('Rename Query')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });
});
