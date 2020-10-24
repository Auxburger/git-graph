const CLASS_DIALOG_ACTIVE = 'dialogActive';
const CLASS_DIALOG_INPUT_INVALID = 'inputInvalid';
const CLASS_DIALOG_NO_INPUT = 'noInput';

const enum DialogType {
	Form,
	ActionRunning,
	Message
}

const enum DialogInputType {
	Text,
	TextRef,
	Select,
	Radio,
	Checkbox
}

interface DialogTextInput {
	readonly type: DialogInputType.Text;
	readonly name: string;
	readonly default: string;
	readonly placeholder: string | null;
	readonly info?: string;
}

interface DialogTextRefInput {
	readonly type: DialogInputType.TextRef;
	readonly name: string;
	readonly default: string;
	readonly info?: string;
}

type DialogSelectInput = {
	readonly type: DialogInputType.Select;
	readonly name: string;
	readonly options: ReadonlyArray<DialogSelectInputOption>;
	readonly default: string;
	readonly multiple?: false;
	readonly info?: string;
} | {
	readonly type: DialogInputType.Select;
	readonly name: string;
	readonly options: ReadonlyArray<DialogSelectInputOption>;
	readonly defaults: ReadonlyArray<string>;
	readonly multiple: true;
	readonly info?: string;
};

interface DialogRadioInput {
	readonly type: DialogInputType.Radio;
	readonly name: string;
	readonly options: ReadonlyArray<DialogRadioInputOption>;
	readonly default: string;
}

interface DialogCheckboxInput {
	readonly type: DialogInputType.Checkbox;
	readonly name: string;
	readonly value: boolean;
	readonly info?: string;
}

interface DialogSelectInputOption {
	readonly name: string;
	readonly value: string;
}

interface DialogRadioInputOption {
	readonly name: string;
	readonly value: string;
}

type DialogInput = DialogTextInput | DialogTextRefInput | DialogSelectInput | DialogRadioInput | DialogCheckboxInput;
type DialogInputValue = string | string[] | boolean;

type DialogTarget = {
	type: TargetType.Commit | TargetType.Ref | TargetType.CommitDetailsView;
	elem: HTMLElement;
	hash: string;
	ref?: string;
} | RepoTarget;

class Dialog {
	private elem: HTMLElement | null = null;
	private target: DialogTarget | null = null;
	private actioned: (() => void) | null = null;
	private type: DialogType | null = null;
	private customSelects: { [inputIndex: string]: CustomSelect } = {};

	public showConfirmation(message: string, actionName: string, actioned: () => void, target: DialogTarget | null) {
		this.show(DialogType.Form, message, actionName, 'Cancel', () => {
			this.close();
			actioned();
		}, null, target);
	}

	public showTwoButtons(message: string, buttonLabel1: string, buttonAction1: () => void, buttonLabel2: string, buttonAction2: () => void, target: DialogTarget | null) {
		this.show(DialogType.Form, message, buttonLabel1, buttonLabel2, () => {
			this.close();
			buttonAction1();
		}, () => {
			this.close();
			buttonAction2();
		}, target);
	}

	public showRefInput(message: string, defaultValue: string, actionName: string, actioned: (value: string) => void, target: DialogTarget | null) {
		this.showForm(message, [
			{ type: DialogInputType.TextRef, name: '', default: defaultValue }
		], actionName, (values) => actioned(<string>values[0]), target);
	}

	public showCheckbox(message: string, checkboxLabel: string, checkboxValue: boolean, actionName: string, actioned: (value: boolean) => void, target: DialogTarget | null) {
		this.showForm(message, [
			{ type: DialogInputType.Checkbox, name: checkboxLabel, value: checkboxValue }
		], actionName, (values) => actioned(<boolean>values[0]), target);
	}

	public showSelect(message: string, defaultValue: string, options: ReadonlyArray<DialogSelectInputOption>, actionName: string, actioned: (value: string) => void, target: DialogTarget | null) {
		this.showForm(message, [
			{ type: DialogInputType.Select, name: '', options: options, default: defaultValue }
		], actionName, (values) => actioned(<string>values[0]), target);
	}

	public showMultiSelect(message: string, defaultValues: ReadonlyArray<string>, options: ReadonlyArray<DialogSelectInputOption>, actionName: string, actioned: (value: string[]) => void, target: DialogTarget | null) {
		this.showForm(message, [
			{ type: DialogInputType.Select, name: '', options: options, defaults: defaultValues, multiple: true }
		], actionName, (values) => actioned(<string[]>values[0]), target);
	}

	public showForm(message: string, inputs: ReadonlyArray<DialogInput>, actionName: string, actioned: (values: DialogInputValue[]) => void, target: DialogTarget | null, secondaryActionName: string = 'Cancel', secondaryActioned: ((values: DialogInputValue[]) => void) | null = null, includeLineBreak: boolean = true) {
		const multiElement = inputs.length > 1;
		const multiCheckbox = multiElement && inputs.every((input) => input.type === DialogInputType.Checkbox);
		const infoColRequired = inputs.some((input) => input.type !== DialogInputType.Checkbox && input.type !== DialogInputType.Radio && input.info);
		const inputRowsHtml = inputs.map((input, id) => {
			let inputHtml;
			if (input.type === DialogInputType.Radio) {
				inputHtml = '<td class="inputCol"' + (infoColRequired ? ' colspan="2"' : '') + '><span class="dialogFormRadio">' +
					input.options.map((option, optionId) => '<label><input type="radio" name="dialogInput' + id + '" value="' + optionId + '"' + (option.value === input.default ? ' checked' : '') + ' tabindex="' + (id + 1) + '"/><span class="customRadio"></span>' + escapeHtml(option.name) + '</label>').join('<br>') +
					'</span></td>';
			} else {
				const infoHtml = input.info ? '<span class="dialogInfo" title="' + escapeHtml(input.info) + '">' + SVG_ICONS.info + '</span>' : '';
				if (input.type === DialogInputType.Select) {
					inputHtml = '<td class="inputCol"><div id="dialogFormSelect' + id + '"></div></td>' + (infoColRequired ? '<td>' + infoHtml + '</td>' : '');
				} else if (input.type === DialogInputType.Checkbox) {
					inputHtml = '<td class="inputCol"' + (infoColRequired ? ' colspan="2"' : '') + '><span class="dialogFormCheckbox"><label><input id="dialogInput' + id + '" type="checkbox"' + (input.value ? ' checked' : '') + ' tabindex="' + (id + 1) + '"/><span class="customCheckbox"></span>' + (multiElement && !multiCheckbox ? '' : input.name) + infoHtml + '</label></span></td>';
				} else {
					inputHtml = '<td class="inputCol"><input id="dialogInput' + id + '" type="text" value="' + escapeHtml(input.default) + '"' + (input.type === DialogInputType.Text && input.placeholder !== null ? ' placeholder="' + escapeHtml(input.placeholder) + '"' : '') + ' tabindex="' + (id + 1) + '"/></td>' + (infoColRequired ? '<td>' + infoHtml + '</td>' : '');
				}
			}
			return '<tr' + (input.type === DialogInputType.Radio ? ' class="mediumField"' : input.type !== DialogInputType.Checkbox ? ' class="largeField"' : '') + '>' + (multiElement && !multiCheckbox ? '<td>' + input.name + ': </td>' : '') + inputHtml + '</tr>';
		});

		const html = message + (includeLineBreak ? '<br>' : '') +
			'<table class="dialogForm ' + (multiElement ? multiCheckbox ? 'multiCheckbox' : 'multi' : 'single') + '">' +
			inputRowsHtml.join('') +
			'</table>';

		const areFormValuesInvalid = () => this.elem === null || this.elem.classList.contains(CLASS_DIALOG_NO_INPUT) || this.elem.classList.contains(CLASS_DIALOG_INPUT_INVALID);
		const getFormValues = () => inputs.map((input, index) => {
			if (input.type === DialogInputType.Radio) {
				// Iterate through all of the radio options to get the checked value
				const elems = <NodeListOf<HTMLInputElement>>document.getElementsByName('dialogInput' + index);
				for (let i = 0; i < elems.length; i++) {
					if (elems[i].checked) {
						return input.options[parseInt(elems[i].value)].value;
					}
				}
				return input.default; // If no option is checked, return the default value
			} else if (input.type === DialogInputType.Select) {
				return this.customSelects[index.toString()].getValue();
			} else {
				const elem = <HTMLInputElement>document.getElementById('dialogInput' + index);
				return input.type === DialogInputType.Checkbox
					? elem.checked // Checkboxes return a boolean indicating if the value is checked
					: elem.value; // All other fields return the value as a string
			}
		});

		this.show(DialogType.Form, html, actionName, secondaryActionName, () => {
			if (areFormValuesInvalid()) return;
			const values = getFormValues();
			this.close();
			actioned(values);
		}, secondaryActioned !== null ? () => {
			if (areFormValuesInvalid()) return;
			const values = getFormValues();
			this.close();
			secondaryActioned(values);
		} : null, target);

		// Create custom select inputs
		inputs.forEach((input, index) => {
			if (input.type === DialogInputType.Select) {
				this.customSelects[index.toString()] = new CustomSelect(input, 'dialogFormSelect' + index, index + 1, this.elem!);
			}
		});

		// If the dialog contains a TextRef input, attach event listeners for validation
		const textRefInput = inputs.findIndex((input) => input.type === DialogInputType.TextRef);
		if (textRefInput > -1) {
			let dialogInput = <HTMLInputElement>document.getElementById('dialogInput' + textRefInput), dialogAction = document.getElementById('dialogAction')!;
			if (dialogInput.value === '') this.elem!.classList.add(CLASS_DIALOG_NO_INPUT);
			dialogInput.addEventListener('keyup', () => {
				if (this.elem === null) return;
				let noInput = dialogInput.value === '', invalidInput = dialogInput.value.match(REF_INVALID_REGEX) !== null;
				alterClass(this.elem, CLASS_DIALOG_NO_INPUT, noInput);
				if (alterClass(this.elem, CLASS_DIALOG_INPUT_INVALID, !noInput && invalidInput)) {
					dialogAction.title = invalidInput ? 'Unable to ' + actionName + ', one or more invalid characters entered.' : '';
				}
			});
		}

		if (inputs.length > 0 && (inputs[0].type === DialogInputType.Text || inputs[0].type === DialogInputType.TextRef)) {
			// If the first input is a text field, set focus to it.
			(<HTMLInputElement>document.getElementById('dialogInput0')).focus();
		}
	}

	public showMessage(html: string) {
		this.show(DialogType.Message, html, null, 'Close', null, null, null);
	}

	public showError(message: string, reason: GG.ErrorInfo, actionName: string | null, actioned: (() => void) | null) {
		this.show(DialogType.Message, '<span class="dialogAlert">' + SVG_ICONS.alert + 'Error: ' + message + '</span>' + (reason !== null ? '<br><span class="messageContent errorContent">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : ''), actionName, 'Dismiss', () => {
			this.close();
			if (actioned !== null) actioned();
		}, null, null);
	}

	public showActionRunning(action: string) {
		this.show(DialogType.ActionRunning, '<span class="actionRunning">' + SVG_ICONS.loading + action + ' ...</span>', null, 'Dismiss', null, null, null);
	}

	private show(type: DialogType, html: string, actionName: string | null, secondaryActionName: string, actioned: (() => void) | null, secondaryActioned: (() => void) | null, target: DialogTarget | null) {
		closeDialogAndContextMenu();

		this.type = type;
		this.target = target;
		eventOverlay.create('dialogBacking', null, null);

		const dialog = document.createElement('div'), dialogContent = document.createElement('div');
		dialog.className = 'dialog';
		dialogContent.className = 'dialogContent';
		dialogContent.innerHTML = html + '<br>' + (actionName !== null ? '<div id="dialogAction" class="roundedBtn">' + actionName + '</div>' : '') + '<div id="dialogSecondaryAction" class="roundedBtn">' + secondaryActionName + '</div>';
		dialog.appendChild(dialogContent);
		this.elem = dialog;
		document.body.appendChild(dialog);

		let docHeight = document.body.clientHeight, dialogHeight = dialog.clientHeight + 2;
		if (type !== DialogType.Form && dialogHeight > 0.8 * docHeight) {
			dialogContent.style.height = Math.round(0.8 * docHeight - 22) + 'px';
			dialogHeight = Math.round(0.8 * docHeight);
		}
		dialog.style.top = Math.max(Math.round((docHeight - dialogHeight) / 2), 10) + 'px';
		if (actionName !== null && actioned !== null) {
			document.getElementById('dialogAction')!.addEventListener('click', actioned);
			this.actioned = actioned;
		}
		document.getElementById('dialogSecondaryAction')!.addEventListener('click', secondaryActioned !== null ? secondaryActioned : () => this.close());

		if (this.target !== null && this.target.type !== TargetType.Repo) {
			alterClass(this.target.elem, CLASS_DIALOG_ACTIVE, true);
		}
	}

	public close() {
		eventOverlay.remove();
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		alterClassOfCollection(<HTMLCollectionOf<HTMLElement>>document.getElementsByClassName(CLASS_DIALOG_ACTIVE), CLASS_DIALOG_ACTIVE, false);
		this.target = null;
		Object.keys(this.customSelects).forEach((index) => this.customSelects[index].remove());
		this.customSelects = {};
		this.actioned = null;
		this.type = null;
	}

	public closeActionRunning() {
		if (this.type === DialogType.ActionRunning) this.close();
	}

	public submit() {
		if (this.actioned !== null) this.actioned();
	}

	public refresh(commits: ReadonlyArray<GG.GitCommit>) {
		if (!this.isOpen() || this.target === null || this.target.type === TargetType.Repo) {
			// Don't need to refresh if: no dialog is open, it is not dynamic, or it is not reliant on commit changes
			return;
		}

		const commitIndex = commits.findIndex((commit) => commit.hash === (<CommitTarget | RefTarget>this.target).hash);
		if (commitIndex > -1) {
			// The commit still exists

			const commitElem = findCommitElemWithId(getCommitElems(), commitIndex);
			if (commitElem !== null) {
				if (typeof this.target.ref === 'undefined') {
					// Dialog is only dependent on the commit itself
					if (this.target.type !== TargetType.CommitDetailsView) {
						this.target.elem = commitElem;
						alterClass(this.target.elem, CLASS_DIALOG_ACTIVE, true);
					}
					return;
				} else {
					// Dialog is dependent on the commit and ref 
					const elems = <NodeListOf<HTMLElement>>commitElem.querySelectorAll('[data-fullref]');
					for (let i = 0; i < elems.length; i++) {
						if (elems[i].dataset.fullref! === this.target.ref) {
							this.target.elem = this.target.type === TargetType.Ref ? elems[i] : commitElem;
							alterClass(this.target.elem, CLASS_DIALOG_ACTIVE, true);
							return;
						}
					}
				}
			}
		}

		this.close();
	}

	public isOpen() {
		return this.elem !== null;
	}

	public isTargetDynamicSource() {
		return this.isOpen() && this.target !== null;
	}

	public getType() {
		return this.type;
	}
}

class CustomSelect {
	private readonly data: DialogSelectInput;
	private readonly selected: boolean[];
	private lastSelected: number = -1;
	private focussed: number = -1;
	private open: boolean;

	private dialogElem: HTMLElement | null;
	private elem: HTMLElement | null;
	private currentElem: HTMLElement | null;
	private optionsElem: HTMLElement | null = null;
	private clickHandler: ((e: MouseEvent) => void) | null;

	constructor(data: DialogSelectInput, containerId: string, tabIndex: number, dialogElem: HTMLElement) {
		this.data = data;
		this.selected = data.options.map(() => false);
		this.open = false;
		this.dialogElem = dialogElem;

		const container = document.getElementById(containerId)!;
		container.className = 'customSelectContainer';
		this.elem = container;

		const currentElem = document.createElement('div');
		currentElem.className = 'customSelectCurrent';
		currentElem.tabIndex = tabIndex;
		this.currentElem = currentElem;
		container.appendChild(currentElem);

		this.clickHandler = (e: MouseEvent) => {
			if (!e.target) return;
			const targetElem = <HTMLElement>e.target;
			if (targetElem.closest('.customSelectContainer') !== this.elem && (this.optionsElem === null || targetElem.closest('.customSelectOptions') !== this.optionsElem)) {
				this.render(false);
				return;
			}

			if (targetElem.className === 'customSelectCurrent') {
				this.render(!this.open);
			} else if (this.open) {
				const optionElem = <HTMLElement | null>targetElem.closest('.customSelectOption');
				if (optionElem !== null) {
					const selectedOptionIndex = parseInt(optionElem.dataset.index!);
					this.setItemSelectedState(selectedOptionIndex, data.multiple ? !this.selected[selectedOptionIndex] : true);
					if (!this.data.multiple) {
						this.render(false);
					}
					if (this.currentElem !== null) {
						this.currentElem.focus();
					}
				}
			}
		};
		document.addEventListener('click', this.clickHandler, true);

		currentElem.addEventListener('keydown', (e) => {
			if (this.open && e.key === 'Tab') {
				this.render(false);
			} else if (this.open && (e.key === 'Enter' || e.key === 'Escape')) {
				this.render(false);
				handledEvent(e);
			} else if (this.data.multiple) {
				if (e.key === ' ' && this.focussed > -1) {
					this.setItemSelectedState(this.focussed, !this.selected[this.focussed]);
					handledEvent(e);
				} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
					if (!this.open) {
						this.render(true);
					}
					this.setFocussed(this.focussed > 0 ? this.focussed - 1 : this.data.options.length - 1);
					this.scrollOptionIntoView(this.focussed);
					handledEvent(e);
				} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
					if (!this.open) {
						this.render(true);
					}
					this.setFocussed(this.focussed < this.data.options.length - 1 ? this.focussed + 1 : 0);
					this.scrollOptionIntoView(this.focussed);
					handledEvent(e);
				}
			} else {
				if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
					this.setItemSelectedState(this.lastSelected > 0 ? this.lastSelected - 1 : this.data.options.length - 1, true);
					this.scrollOptionIntoView(this.lastSelected);
					handledEvent(e);
				} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
					this.setItemSelectedState(this.lastSelected < this.data.options.length - 1 ? this.lastSelected + 1 : 0, true);
					this.scrollOptionIntoView(this.lastSelected);
					handledEvent(e);
				}
			}
		});

		if (data.multiple) {
			for (let i = data.options.length - 1; i >= 0; i--) {
				if (data.defaults.includes(data.options[i].value)) {
					this.setItemSelectedState(i, true);
				}
			}
		} else {
			const defaultIndex = data.options.findIndex((option) => option.value === data.default);
			this.setItemSelectedState(defaultIndex > -1 ? defaultIndex : 0, true);
		}
		this.renderCurrentValue();
	}

	public remove() {
		this.dialogElem = null;
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		if (this.currentElem !== null) {
			this.currentElem.remove();
			this.currentElem = null;
		}
		if (this.optionsElem !== null) {
			this.optionsElem.remove();
			this.optionsElem = null;
		}
		if (this.clickHandler !== null) {
			document.removeEventListener('click', this.clickHandler, true);
			this.clickHandler = null;
		}
	}

	public getValue() {
		const values = this.data.options.map((option) => option.value).filter((_, index) => this.selected[index]);
		return this.data.multiple ? values : values[0];
	}

	private setItemSelectedState(index: number, state: boolean) {
		if (!this.data.multiple && this.lastSelected > -1) {
			this.selected[this.lastSelected] = false;
		}
		this.selected[index] = state;
		this.lastSelected = index;
		this.renderCurrentValue();
		this.renderOptionsStates();
	}

	private setFocussed(index: number) {
		if (this.focussed !== index) {
			if (this.focussed > -1) {
				const currentlyFocussedOption = this.getOptionElem(this.focussed);
				if (currentlyFocussedOption !== null) {
					alterClass(currentlyFocussedOption, CLASS_FOCUSSED, false);
				}
			}
			this.focussed = index;
			const newlyFocussedOption = this.getOptionElem(this.focussed);
			if (newlyFocussedOption !== null) {
				alterClass(newlyFocussedOption, CLASS_FOCUSSED, true);
			}
		}
	}

	private render(open: boolean) {
		if (this.elem === null || this.currentElem === null || this.dialogElem === null) return;

		if (this.open !== open) {
			this.open = open;
			if (open) {
				if (this.optionsElem !== null) {
					this.optionsElem.remove();
				}
				this.optionsElem = document.createElement('div');
				const currentElemRect = this.currentElem.getBoundingClientRect(), dialogElemRect = this.dialogElem.getBoundingClientRect();
				this.optionsElem.style.top = (currentElemRect.top - dialogElemRect.top + currentElemRect.height - 2) + 'px';
				this.optionsElem.style.left = (currentElemRect.left - dialogElemRect.left - 1) + 'px';
				this.optionsElem.style.width = currentElemRect.width + 'px';
				this.optionsElem.style.maxHeight = Math.max(document.body.clientHeight - currentElemRect.top - currentElemRect.height - 2, 50) + 'px';
				this.optionsElem.className = 'customSelectOptions' + (this.data.multiple ? ' multiple' : '');
				const icon = this.data.multiple ? '<div class="selectedIcon">' + SVG_ICONS.check + '</div>' : '';
				this.optionsElem.innerHTML = this.data.options.map((option, index) =>
					'<div class="customSelectOption" data-index="' + index + '">' + icon + escapeHtml(option.name) + '</div>'
				).join('');
				addListenerToCollectionElems(this.optionsElem.children, 'mousemove', (e) => {
					if (!e.target) return;
					const elem = (<HTMLElement>e.target).closest('.customSelectOption');
					if (elem === null) return;
					this.setFocussed(parseInt((<HTMLElement>elem).dataset.index!));
				});
				this.optionsElem.addEventListener('mouseleave', () => this.setFocussed(-1));
				this.dialogElem.appendChild(this.optionsElem);
			} else {
				if (this.optionsElem !== null) {
					this.optionsElem.remove();
					this.optionsElem = null;
				}
				this.setFocussed(-1);
			}
			alterClass(this.elem, 'open', open);
		}

		if (open) {
			this.renderOptionsStates();
		}
	}

	private renderCurrentValue() {
		if (this.currentElem === null) return;
		const value = formatCommaSeparatedList(this.data.options.filter((_, index) => this.selected[index]).map((option) => option.name)) || 'None';
		this.currentElem.title = value;
		this.currentElem.innerHTML = escapeHtml(value);
	}

	private renderOptionsStates() {
		if (this.optionsElem !== null) {
			let optionElems = this.optionsElem.children, elemIndex: number;
			for (let i = 0; i < optionElems.length; i++) {
				elemIndex = parseInt((<HTMLElement>optionElems[i]).dataset.index!);
				alterClass(<HTMLElement>optionElems[i], CLASS_SELECTED, this.selected[elemIndex]);
				alterClass(<HTMLElement>optionElems[i], CLASS_FOCUSSED, this.focussed === elemIndex);
			}
		}
	}

	private getOptionElem(index: number) {
		if (this.optionsElem !== null && index > -1) {
			const optionElems = this.optionsElem.children, indexStr = index.toString();
			for (let i = 0; i < optionElems.length; i++) {
				if ((<HTMLElement>optionElems[i]).dataset.index === indexStr) {
					return <HTMLElement>optionElems[i];
				}
			}
		}
		return null;
	}

	private scrollOptionIntoView(index: number) {
		const elem = this.getOptionElem(index);
		if (this.optionsElem !== null && elem !== null) {
			const elemOffsetTop = elem.offsetTop, elemHeight = elem.clientHeight;
			const optionsScrollTop = this.optionsElem.scrollTop, optionsHeight = this.optionsElem.clientHeight;
			if (elemOffsetTop < optionsScrollTop) {
				this.optionsElem.scroll(0, elemOffsetTop);
			} else if (elemOffsetTop + elemHeight > optionsScrollTop + optionsHeight) {
				this.optionsElem.scroll(0, Math.max(elemOffsetTop + elemHeight - optionsHeight, 0));
			}
		}
	}
}
