// Strict CSS lint; CI runs with --max-warnings 0.
export default {
  extends: ['stylelint-config-standard'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  rules: {
    // the stylesheet intentionally keeps compact one-line rule blocks for related game UI pieces
    'declaration-block-single-line-max-declarations': null,
    // Safari still needs these prefixes (text gradients, masked chest rays, non-selectable game UI)
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-user-select', '-webkit-background-clip', '-webkit-mask-image'] }],
    // flags unrelated components (e.g. `.lineup img` vs `.card.char img`) in this flat stylesheet;
    // it is an ordering heuristic, not a correctness check
    'no-descending-specificity': null,
  },
};
