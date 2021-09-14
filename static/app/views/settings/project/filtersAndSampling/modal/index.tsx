import ErrorRuleModal from './errorRuleModal';
import TransactionRuleModal from './transactionRuleModal';

type Props = React.ComponentProps<typeof ErrorRuleModal> & {
  type: 'error' | 'transaction';
};

function Modal({type, ...props}: Props) {
  if (type === 'error') {
    return <ErrorRuleModal {...props} />;
  }

  return <TransactionRuleModal {...props} />;
}

export default Modal;
