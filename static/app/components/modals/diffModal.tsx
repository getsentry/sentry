import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import IssueDiff from 'sentry/components/issueDiff';

type Props = ModalRenderProps & React.ComponentProps<typeof IssueDiff>;

function DiffModal({className, Body, CloseButton, ...props}: Props) {
  return (
    <Body>
      <CloseButton />
      <IssueDiff className={className} {...props} />
    </Body>
  );
}

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
