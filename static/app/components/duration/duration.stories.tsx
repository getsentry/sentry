import Duration from 'sentry/components/duration/duration';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Duration', story => {
  story('Default format ("hh:mm:ss.sss")', () => (
    <ul>
      <li>
        One millisecond = <Duration duration={[1, 'ms']} precision="ms" />
      </li>
      <li>
        One second = <Duration duration={[1, 'sec']} precision="sec" />
      </li>
      <li>
        One minute = <Duration duration={[1, 'min']} precision="min" />
      </li>
      <li>
        One hour = <Duration duration={[1, 'hour']} precision="hour" />
      </li>
      <li>
        One day = <Duration duration={[1, 'day']} precision="day" />
      </li>
      <li>
        One week = <Duration duration={[1, 'week']} precision="week" />
      </li>
    </ul>
  ));
});
