import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CustomRepoType} from 'sentry/types/debugFiles';

import {Http} from './http';
import {GcsRepository, S3Repository} from './objectStorage';

const stubEl = ({children}: {children?: React.ReactNode}) => <div>{children}</div>;
const modalProps = {
  Header: stubEl as ModalRenderProps['Header'],
  Body: stubEl as ModalRenderProps['Body'],
  Footer: stubEl as ModalRenderProps['Footer'],
};

describe('DebugFileCustomRepository', () => {
  it('keeps HTTP submissions pending and preserves an unchanged password', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const onSubmit = jest.fn(() => promise);

    render(
      <Http
        {...modalProps}
        onSubmit={onSubmit}
        initialData={{
          id: 'http-repository',
          layout: {type: 'native', casing: 'default'},
          name: 'HTTP Repository',
          password: {'hidden-secret': true},
          type: CustomRepoType.HTTP,
          url: 'https://example.com/symbols/',
          username: 'admin',
        }}
      />
    );

    const saveButton = screen.getByRole('button', {name: 'Save changes'});
    expect(saveButton).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), ' Updated');
    expect(saveButton).toBeEnabled();

    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          password: {'hidden-secret': true},
          type: CustomRepoType.HTTP,
        })
      )
    );
    expect(saveButton).toBeDisabled();

    resolve();
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it('preserves an unchanged S3 secret', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <S3Repository
        {...modalProps}
        onSubmit={onSubmit}
        sourceConfig={{
          access_key: 'access-key',
          bucket: 'symbols',
          id: 's3-repository',
          layout: {type: 'native', casing: 'default'},
          name: 'S3 Repository',
          region: 'us-east-1',
          secret_key: {'hidden-secret': true},
          type: CustomRepoType.S3,
        }}
      />
    );

    const saveButton = screen.getByRole('button', {name: 'Save changes'});
    expect(saveButton).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), ' Updated');
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          secret_key: {'hidden-secret': true},
          type: CustomRepoType.S3,
        })
      )
    );
  });

  it('validates GCS email and preserves an unchanged private key', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <GcsRepository
        {...modalProps}
        onSubmit={onSubmit}
        sourceConfig={{
          bucket: 'symbols',
          client_email: 'service-account@example.com',
          id: 'gcs-repository',
          layout: {type: 'native', casing: 'default'},
          name: 'GCS Repository',
          private_key: {'hidden-secret': true},
          type: CustomRepoType.GCS,
        }}
      />
    );

    const emailInput = screen.getByRole('textbox', {name: 'Client Email'});
    const saveButton = screen.getByRole('button', {name: 'Save changes'});

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'invalid-email');
    await userEvent.click(saveButton);

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'updated@example.com');
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          client_email: 'updated@example.com',
          private_key: {'hidden-secret': true},
          type: CustomRepoType.GCS,
        })
      )
    );
  });
});
