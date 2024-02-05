import {NumberContainer} from 'sentry/utils/discover/styles';
import ResourceSize from 'sentry/views/performance/browser/resources/shared/resourceSize';

type Props = {
  bytes?: number;
};

export function ResourceSizeCell(props: Props) {
  const {bytes} = props;
  return (
    <NumberContainer>
      <ResourceSize bytes={bytes} />
    </NumberContainer>
  );
}

export default ResourceSizeCell;
