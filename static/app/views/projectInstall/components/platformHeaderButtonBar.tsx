import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';

type Props = {
  docsLink: string;
  gettingStartedLink: string;
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
