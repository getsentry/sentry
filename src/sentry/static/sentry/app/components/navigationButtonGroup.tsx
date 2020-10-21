import {Location} from 'history';

import {t} from 'app/locale';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconPrevious, IconNext} from 'app/icons';

type Props = {
  location: Location;
  /**
   * A set of pathName's that will be used in the buttons in the following order:
   * [OldestURL, OlderURL, NewerURL, NewestURL]
   */
  urls: [string, string, string, string];
  hasNext?: boolean;
  hasPrevious?: boolean;
  className?: string;
};

const NavigationButtonGroup = ({
  location,
  urls,
  hasNext = false,
  hasPrevious = false,
  className,
}: Props) => (
  <ButtonBar className={className} merged>
    <Button
      size="small"
      to={{pathname: urls[0], query: location.query}}
      disabled={!hasPrevious}
      label={t('Oldest')}
      icon={<IconPrevious size="xs" />}
    />
    <Button
      size="small"
      to={{
        pathname: urls[1],
        query: location.query,
      }}
      disabled={!hasPrevious}
    >
      {t('Older')}
    </Button>
    <Button
      size="small"
      to={{pathname: urls[2], query: location.query}}
      disabled={!hasNext}
    >
      {t('Newer')}
    </Button>
    <Button
      size="small"
      to={{pathname: urls[3], query: location.query}}
      disabled={!hasNext}
      label={t('Newest')}
      icon={<IconNext size="xs" />}
    />
  </ButtonBar>
);

export default NavigationButtonGroup;
