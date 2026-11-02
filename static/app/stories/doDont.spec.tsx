import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Do, DoDont, Dont} from './doDont';

describe('DoDont', () => {
  it('labels each example with its caption', () => {
    render(
      <DoDont>
        <Do caption="Keep a visible label.">Recommended example</Do>
        <Dont caption="Don't use the placeholder as the label.">Mistake example</Dont>
      </DoDont>
    );

    const [recommended, mistake] = screen.getAllByRole('figure');
    expect(recommended).toHaveTextContent('Recommended example');
    expect(recommended).toHaveTextContent('Do');
    expect(recommended).toHaveTextContent('Keep a visible label.');
    expect(mistake).toHaveTextContent('Mistake example');
    expect(mistake).toHaveTextContent("Don't");
    expect(mistake).toHaveTextContent("Don't use the placeholder as the label.");
  });
});
