// English text: the source for every other language. Placeholders are {name};
// a plural message has a form per CLDR plural category (Intl.PluralRules) and
// is chosen by its {count} parameter.

export interface Plural {
  one: string;
  few?: string;
  other: string;
}

export const en = {
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.clear': 'Clear',

  'kind.whist': 'Romanian Whist',
  'kind.whistShort': 'Whist',
  'kind.rentz': 'Rentz',

  'home.tagline': 'Romanian Whist and Rentz, scored for you. Works offline.',
  'home.newGame': 'New game',
  'home.import': 'Import game',
  'home.settings': 'Settings',
  'home.imported': 'Game imported.',
  'home.importFailed': 'Could not import that file: it is not a Scorekeeper game.',
  'home.empty': 'No games yet. Start one with “{action}”.',
  'home.inProgress': 'In progress',
  'home.finished': 'Finished',
  'home.winner': 'Winner: {name} ({total})',
  'home.roundOf': 'Round {round} of {total}',
  'home.delete': 'Delete',
  'home.deleteGame': 'Delete game of {players}',
  'home.deleteConfirm': 'Delete this game?',

  'setup.title': 'New game',
  'setup.game': 'Game',
  'setup.players': 'Players',
  'setup.playerCount': 'Number of players',
  'setup.fewer': 'Fewer players',
  'setup.more': 'More players',
  'setup.seatingWhist': 'In seating order around the table. Mark who bets first.',
  'setup.seatingRentz': 'In seating order around the table. Mark who chooses the contract first.',
  'setup.defaultName': 'Player {n}',
  'setup.nameLabel': 'Player {n} name',
  'setup.starts': 'Starts',
  'setup.startHere': 'Start here',
  'setup.duplicate': 'Two players have the same name.',
  'setup.startWithEights': 'Start with the 8-card rounds',
  'setup.rentzRounds': {
    one: 'Each player chooses each of the 8 contracts once: {count} round.',
    other: 'Each player chooses each of the 8 contracts once: {count} rounds.',
  } satisfies Plural,
  'setup.start': 'Start',

  'sheet.back': 'Back to games',
  'sheet.games': 'Games',
  'sheet.undo': 'Undo',
  'sheet.redo': 'Redo',
  'sheet.standings': 'Standings',
  'sheet.export': 'Export',
  'sheet.cards': 'Cards',
  'sheet.contract': 'Contract',
  'sheet.score': 'Score',
  'sheet.taken': 'Taken',
  'sheet.choose': 'Choose',
  'sheet.firstHint': '1st',
  'sheet.chooses': '{name} chooses',
  'sheet.chooseContract': 'Choose contract',
  'sheet.finalStandings': 'Final standings',
  'sheet.standingsAfter': 'Standings after round {round}',
  'sheet.copy': 'Copy',
  'sheet.totals': 'Totals: All the the special cards count.',
  'sheet.cellLabel': '{player}, {field}, round {round}',
  'sheet.padTitle': '{player} · {field} · round {round}',

  'field.bet': 'Bet',
  'field.tricks': 'Tricks',
  'field.queens': 'Queens',
  'field.diamonds': 'Diamonds',
  'field.kingOfHearts': 'King of Hearts',
  'field.place': 'Place',
  'fieldShort.tricks': 'T',
  'fieldShort.queens': 'Q',
  'fieldShort.diamonds': '♦',
  'fieldShort.kingOfHearts': 'K♥',
  'fieldShort.place': '#',

  'contract.small-bids': 'Small Bids',
  'contract.big-bids': 'Big Bids',
  'contract.queens': 'Queens',
  'contract.diamonds': 'Diamonds',
  'contract.king-of-hearts': 'King of Hearts',
  'contract.big-totals': 'Big Totals',
  'contract.small-totals': 'Small Totals',
  'contract.rentz': 'Rentz',
  'contractShort.small-bids': 'SB',
  'contractShort.big-bids': 'BB',
  'contractShort.queens': 'Q',
  'contractShort.diamonds': 'D',
  'contractShort.king-of-hearts': 'KH',
  'contractShort.big-totals': 'BT',
  'contractShort.small-totals': 'ST',
  'contractShort.rentz': 'R',

  'issue.bannedBet': "{name} bets last and can't bet {bet}.",
  'issue.tricksTotal': 'Tricks add up to {actual}, not {expected}.',
  'issue.betTooHigh': "{name}'s bet is more than {max}.",
  'issue.tricksTooHigh': "{name}'s tricks are more than {max}.",
  'issue.total.tricks': 'Tricks add up to {actual}, not {expected}.',
  'issue.total.queens': 'Queens add up to {actual}, not {expected}.',
  'issue.total.diamonds': 'Diamonds add up to {actual}, not {expected}.',
  'issue.kingOfHearts': 'Exactly one player takes the King of Hearts ({count} marked).',
  'issue.placesDuplicate': 'Each place can only be used once.',
  'issue.placesRange': 'Places go from 1 to {max}.',

  'pad.notAllowed': 'Not allowed: the bets would add up to the cards dealt',

  'ink.didYouWrite': 'Did you write… ({cell})',
  'ink.noneOfThese': 'None of these',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageAuto': 'Automatic ({language})',
  'settings.fingerWriting': 'Write with a finger too',
  'settings.fingerWritingHelp': 'Off: only a pen writes, and a resting hand is ignored. A finger tap opens the number pad.',
  'settings.inkStats': 'Handwriting so far: read directly {accepted}, picked from suggestions {corrected}.',
  'settings.handwritingCheck': 'Handwriting check',

  'check.title': 'Handwriting check',
  'check.intro': 'Write the digit below in the box, the way you would on the score sheet.',
  'check.result': 'Read correctly: {correct} of {total} ({percent}%)',
  'check.noSamples': 'No samples yet.',
  'check.export': 'Export samples',
} as const;

export type MessageKey = keyof typeof en;

/** Every language provides every key; plural keys need plural forms. */
export type Messages = { [K in MessageKey]: (typeof en)[K] extends string ? string : Plural };
