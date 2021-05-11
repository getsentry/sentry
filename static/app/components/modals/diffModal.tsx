import * as React from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import IssueDiff from 'app/components/issueDiff';

type Props = ModalRenderProps & React.ComponentProps<typeof IssueDiff>;

const DiffModal = ({className, Body, CloseButton, ...props}: Props) => (
  <Body>
    <CloseButton />
    <IssueDiff className={className} {...props} />
  </Body>
);

const modalCss = css`
  position: absolute;
  left: 20px;
  right: 20px;
  top: 20px;
  bottom: 20px;
  display: flex;
  padding: 0;
  width: auto;

  [role='document'] {
    overflow: scroll;
    height: 100%;
    display: flex;
    flex: 1;
  }

  section {
    display: flex;
    width: 100%;
  }
`;

export {modalCss};

export default DiffModal;
