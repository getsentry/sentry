import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';

type Props = {
  url?: string;
};

function FilenameCell(props: Props) {
  const {url} = props;
  const filename = url?.split('/').pop()?.split('?')[0];
  return <OverflowEllipsisTextContainer>{filename}</OverflowEllipsisTextContainer>;
}

export default FilenameCell;
