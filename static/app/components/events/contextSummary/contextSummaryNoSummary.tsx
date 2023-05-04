import Item from './item';

type Props = {
  title: string;
};

function ContextSummaryNoSummary({title}: Props) {
  return (
    <Item>
      <h3 data-test-id="no-summary-title">{title}</h3>
    </Item>
  );
}

export default ContextSummaryNoSummary;
