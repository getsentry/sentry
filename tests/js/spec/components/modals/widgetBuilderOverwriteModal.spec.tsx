import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import OverwriteWidgetModal from 'sentry/components/modals/widgetBuilder/overwriteWidgetModal';
import {DisplayType} from 'sentry/views/dashboardsV2/types';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

describe('widget builder overwrite modal', () => {
  it('renders with the widget title and description', () => {
    const widget = {
      title: 'Test title',
      description: 'Test description',
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [],
    };
    mountWithTheme(
      <OverwriteWidgetModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        iconColor="white"
        widget={widget}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText('Overwrite Widget')).toBeInTheDocument();
    expect(screen.getByText('Test title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('calls the confirm handler and closes the modal when confirmed', () => {
    const widget = {
      title: 'Test title',
      description: 'Test description',
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [],
    };
    const mockOnConfirm = jest.fn();
    const mockCloseModal = jest.fn();
    mountWithTheme(
      <OverwriteWidgetModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={mockCloseModal}
        iconColor="white"
        widget={widget}
        onConfirm={mockOnConfirm}
      />
    );

    userEvent.click(screen.getByText('Confirm'));
    expect(mockOnConfirm).toHaveBeenCalled();

    // Modal should close after confirming
    expect(mockCloseModal).toHaveBeenCalled();
  });
});
