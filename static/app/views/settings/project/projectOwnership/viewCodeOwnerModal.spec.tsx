import {render, screen} from 'sentry-test/reactTestingLibrary';

import ViewCodeOwnerModal from './viewCodeOwnerModal';

describe('ViewCodeOwnerModal', () => {
  const mockComponent: any = ({children}) => <div>{children}</div>;

  it('should display parsed codeowners file', () => {
    const ownershipSyntax = `codeowners:/src/sentry/migrations/ #developer-infrastructure\n`;
    render(
      <ViewCodeOwnerModal
        codeowner={TestStubs.CodeOwner({ownershipSyntax})}
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
