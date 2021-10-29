import {t} from 'app/locale';
import {Frame} from 'app/types';
import {Event} from 'app/types/event';

import EventDataSection from '../../events/eventDataSection';

import Line from './frame/line';

type Props = {
  type: string;
  data: Frame;
  event: Event;
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
