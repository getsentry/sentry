import useA11yData from 'sentry/utils/replays/hooks/useA11yData';

type Props = {};

function A11y({}: Props) {
  const data = useA11yData();
  // eslint-disable-next-line no-console
  console.log(data);

  return <div />;
}

export default A11y;
