import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  docsLink: string;
  gettingStartedLink: string;
};

export default function PlatformHeaderButtonBar({gettingStartedLink, docsLink}: Props) {
  return (
    <ButtonBar gap={1}>
      <Button size="sm" icon={<IconChevron direction="left" />} to={gettingStartedLink}>
        {t('Back')}
      </Button>
      <Button size="sm" href={docsLink} external>
        {t('Full Documentation')}
      </Button>
    </ButtonBar>
  );
}
