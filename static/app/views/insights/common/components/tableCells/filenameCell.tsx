import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';

type Props = {
  url?: string;
};

function FilenameCell(props: Props) {
  const {url} = props;
  const filename = url?.split('/').pop()?.split('?')[0];
  return (
    <WiderHovercard position="right" body={filename}>
      <OverflowEllipsisTextContainer>{filename}</OverflowEllipsisTextContainer>
    </WiderHovercard>
  );
}

export default FilenameCell;
