import Modal from 'react-bootstrap/lib/Modal';
import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import Button from 'app/components/button';

type Props = {
  examples: Array<string>;
  sourceName: string;
};

type State = {
  isOpen: boolean;
};

class SourceSuggestionExamples extends React.Component<Props, State> {
  state: State = {isOpen: false};

  toggleModal = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  stopPropagation = (e: React.MouseEvent<HTMLSpanElement>) => {
    // Necessary to stop propagation of click events from modal that we can't
    // catch otherwise.
    e.stopPropagation();
  };

  render() {
    const {isOpen} = this.state;
    const {examples, sourceName} = this.props;

    return (
      <Wrapper onClick={this.stopPropagation}>
        <Button size="xsmall" onClick={this.toggleModal}>
          {t('examples')}
        </Button>
        {isOpen && (
          <StyledModal show onHide={this.toggleModal}>
            <Modal.Header closeButton>
              {t('Examples for %s in current event', <code>{sourceName}</code>)}
            </Modal.Header>
            <Modal.Body>
              {examples.map(example => (
                <pre key={example}>{example}</pre>
              ))}
            </Modal.Body>
          </StyledModal>
        )}
      </Wrapper>
    );
  }
}

export default SourceSuggestionExamples;

const StyledModal = styled(Modal)`
  .modal-dialog {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) !important;
    margin: 0;
    z-index: 1003;
    @media (max-width: ${p => p.theme.breakpoints[0]}) {
      width: 100%;
    }
  }

  .modal-body {
    max-height: 500px;
    overflow-y: auto;
    padding: ${space(3)} ${space(4)};
    margin: -${space(3)} -${space(4)};
  }

  .close {
    outline: none;
  }
`;

const Wrapper = styled('span')`
  grid-column: 3/3;
`;
