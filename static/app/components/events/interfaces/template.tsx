import {t} from 'sentry/locale';
import {Frame} from 'sentry/types';
import {Event} from 'sentry/types/event';

import EventDataSection from '../../events/eventDataSection';

import Line from './frame/line';

type Props = {
  data: Frame;
  event: Event;
  type: string;
};

const TemplateInterface = ({type, data, event}: Props) => (
  <EventDataSection type={type} title={t('Template')}>
    <div className="traceback no-exception">
      <ul>
        <Line data={data} event={event} registers={{}} components={[]} isExpanded />
      </ul>
    </div>
  </EventDataSection>
);
export default TemplateInterface;
