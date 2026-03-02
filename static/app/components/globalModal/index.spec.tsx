import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Tooltip} from '@sentry/scraps/tooltip';

import {closeModal, openModal} from 'sentry/actionCreators/modal';

describe('GlobalModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uses actionCreators to open and close Modal', async () => {
    renderGlobalModal();

    act(() => openModal(() => <div data-test-id="modal-test">Hi</div>));

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    act(() => closeModal());

    await waitForElementToBeRemoved(screen.queryByTestId('modal-test'));
    expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when modal is clicked out of', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    await userEvent.click(screen.getByTestId('modal-backdrop'));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when escape key is pressed', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    expect(screen.getByText('Hi')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', async () => {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(({closeModal: cm}) => <button onClick={cm}>Yo</button>, {
        onClose: closeSpy,
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Yo'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores click out with closeEvents: 'escape-key'", async () => {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'escape-key', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    expect(closeSpy).not.toHaveBeenCalled();

    // Pressing escape _does_ close
    await userEvent.keyboard('{Escape}');
    await waitForModalToHide();
    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores escape key with closeEvents: 'backdrop-click'", async () => {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'backdrop-click', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Pressing escape doesn't close
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    expect(closeSpy).not.toHaveBeenCalled();

    // Clicking outside of modal _does_ close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(closeSpy).toHaveBeenCalled();
    await waitForModalToHide();
  });

  it("ignores backdrop click and escape key when with closeEvents: 'none'", async () => {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'none', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(closeSpy).not.toHaveBeenCalled();

    // Pressing escape doesn't close
    await userEvent.keyboard('{Escape}');
    expect(closeSpy).not.toHaveBeenCalled();

    // Clicking an explicit close button does close
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeSpy).toHaveBeenCalled();
    await waitForModalToHide();
  });

  it('does not close modal when pressing escape to close a select dropdown', async () => {
    renderGlobalModal();

    act(() =>
      openModal(({Body}) => (
        <Body>
          <CompactSelect
            options={[
              {value: 'opt1', label: 'Option One'},
              {value: 'opt2', label: 'Option Two'},
            ]}
            value="opt1"
            onChange={() => {}}
          />
        </Body>
      ))
    );

    // Open the select dropdown
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();

    // Press ESC — should close the dropdown, NOT the modal
    await userEvent.keyboard('{Escape}');

    // Dropdown should be closed
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

    // Modal should still be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders interactive tooltip inside the modal', async () => {
    renderGlobalModal();

    const buttonClick = jest.fn();

    act(() =>
      openModal(({Body}) => (
        <Body>
          <Tooltip title={<button onClick={buttonClick}>Click me</button>} isHoverable>
            Hi
          </Tooltip>
        </Body>
      ))
    );

    await userEvent.hover(screen.getByText('Hi'));
    await userEvent.click(await screen.findByText('Click me'));

    expect(buttonClick).toHaveBeenCalled();
  });
});
