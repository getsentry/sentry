import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

type Props = {
  type?: React.ComponentProps<typeof Alert>['type'];
};

const PreviewFeature = ({type = 'info'}: Props) => (
  <Alert type={type} showIcon>
    {t(
      'This feature is a preview and may change in the future. Thanks for being an early adopter!'
    )}
  </Alert>
);

export default PreviewFeature;
