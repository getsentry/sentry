import {CodeOwnerFixture} from 'sentry-fixture/codeOwner';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ViewCodeOwnerModal from './viewCodeOwnerModal';

describe('ViewCodeOwnerModal', () => {
  const mockComponent: any = ({children}: {children: React.ReactNode}) => (
    <div>{children}</div>
  );

  it('should display parsed codeowners file', () => {
    const ownershipSyntax = `codeowners:/src/sentry/migrations/ #developer-infrastructure\n`;
    render(
      <ViewCodeOwnerModal
        codeowner={CodeOwnerFixture({ownershipSyntax})}
        closeModal={jest.fn()}
        Header={mockComponent}
        Footer={mockComponent}
        Body={mockComponent}
        CloseButton={mockComponent}
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue(ownershipSyntax);
  });
});
