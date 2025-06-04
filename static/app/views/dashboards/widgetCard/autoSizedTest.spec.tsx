import styled from '@emotion/styled';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutoSizedText} from './autoSizedText';

describe('AutoSizedText', () => {
  it('renders the children', () => {
    render(
      <Container>
        <AutoSizedText>Hello</AutoSizedText>
      </Container>
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

const Container = styled('div')``;
