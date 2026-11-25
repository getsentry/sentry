import {
  webVitalCountField,
  webVitalP75Field,
  webVitalScoreCountField,
  webVitalScoreField,
} from './webVitalTraceMetricFields';

describe('webVitalTraceMetricFields', () => {
  it('reads the vital value from its metric', () => {
    expect(webVitalP75Field('lcp')).toBe(
      'p75(value,browser.web_vital.lcp,distribution,millisecond)'
    );
    expect(webVitalCountField('ttfb')).toBe(
      'count(value,browser.web_vital.ttfb,distribution,millisecond)'
    );
  });

  it('reads the score from the score ratio attribute on the vital metric', () => {
    expect(webVitalScoreField('lcp')).toBe(
      'avg(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)'
    );
    expect(webVitalScoreField('cls')).toBe(
      'avg(tags[score.ratio.cls,number],browser.web_vital.cls,distribution,none)'
    );
    expect(webVitalScoreCountField('inp')).toBe(
      'count(tags[score.ratio.inp,number],browser.web_vital.inp,distribution,millisecond)'
    );
  });
});
