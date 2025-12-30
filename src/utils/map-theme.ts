// This helps TypeScript know about the google object from the script tag
declare const google: any;

export const MARKER_COLORS = {
  lead:            '#00C853',
  opportunity:     '#1E88E5',
  customer:        '#C0CA33',
  oppPastCustomer: '#8E24AA',

  leftDoorHanger:  '#BDBDBD',
  mildInterest:    '#D7CCC8',
  impartial:       '#FB8C00',

  doNotGo:         '#D50000',
  notInterested:   '#8B0000',
};

function normalizeStatus(s: string | undefined): string {
  if (!s) return 'unknown';
  const k = String(s).trim().toLowerCase();

  if (k === 'lead') return 'lead';
  if (k === 'opportunity') return 'opportunity';
  if (k === 'customer') return 'customer';
  if (k === 'opportunity/pastcustomer' || k === 'opportunity / pastcustomer' ||
      k === 'p...ty_pastcustomer' || k === 'past customer' || k === 'opp/past') {
    return 'oppPastCustomer';
  }

  if (k === 'left door hanger' || k === 'door hanger' || k === 'left_door_hanger')
    return 'leftDoorHanger';
  if (k === 'mild interest' || k === 'mild_interest') return 'mildInterest';
  if (k === 'impartial') return 'impartial';

  if (k === 'do not go' || k === 'dng' || k === 'do_not_go') return 'doNotGo';
  if (k === 'not interested' || k === 'not_interested' || k === 'ni') return 'notInterested';

  return 'unknown';
}

const FALLBACK_COLOR = '#9E9E9E';

export function getStatusColor(status: string | undefined): string {
  const key = normalizeStatus(status);
  return MARKER_COLORS[key as keyof typeof MARKER_COLORS] || FALLBACK_COLOR;
}

export const POLYLINE_STYLE = {
  strokeColor: '#06b6d4', // brand color
  strokeOpacity: 0.8,
  strokeWeight: 4,
};
