import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';

type Props = {
  gettingStartedLink: string;
  docsLink: string;
};
export default function PlatformHeaderButtonBar({gettingStartedLink, docsLink}: Props) {
  return (
    <ButtonBar gap={1}>
      <Button size="small" to={gettingStartedLink}>
        {t('< Back')}
      </Button>
      <Button size="small" href={docsLink} external>
        {t('Full Documentation')}
      </Button>
    </ButtonBar>
  );
}
