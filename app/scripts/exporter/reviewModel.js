/* eslint-disable */

/*
class Review {
  constructor(){
    this._strengths = [];
    this._majorConcerns = [];
    this._minorConcerns = [];
  }
  insertStrength(strength){
    strength.review = this;
    this._strengths.push(strength);
  }
  get strengths(){
    return this._strengths;
  }
  insertMajorConcern(majorConcern){
    majorConcern.review = this;
    this._majorConcerns.push(majorConcern);
  }
  get majorConcerns(){
    return this._majorConcerns;
  }
  insertMinorConcern(minorConcern){
    minorConcern.review = this;
    this._minorConcerns.push(minorConcern);
  }
  get minorConcerns(){
    return this._minorConcerns;
  }
  toString(){
    // Summary of the work
    let t = "<Summarize the work>\n\n";

    // Strengths
    if(this._strengths.length>0) t+= "STRENGTHS:\n\n";
    if(this._strengths.length==1){
      t += "The main strength of this work is that "+this._strengths[0].toString()+"\n\n";
    }
    else if(this._strengths.length>1){
      for(let s in this._strengths){
        t += "- "+this._strengths[s].toString()+"\n\n";
      }
      t += "\n\n";
    }

    // Major concerns
    if(this._majorConcerns.length>0){
      t += "MAJOR CONCERNS:\n\n"
      t += "In the following, I express ";
      if(this._majorConcerns.length>1) t += "some important concerns ";
      else t += "an important concern ";
      t += "I have about the manuscript"
      if(this._majorConcerns.length==1) t += ". "+this._majorConcerns[0].toString()+"\n\n";
      else{
        t += ":\n\n";
        for(let i=0;i<this._majorConcerns.length;i++){
          t += (i+1)+"- "+this._majorConcerns[i].toString()+"\n\n";
        }
        t += "\n\n";
      }
    }

    // Minor concerns
    if(this._minorConcerns.length>0){
      t += "MINOR CONCERNS:\n\n"
      t += "There ";
      if(this._minorConcerns.length==1){
        t += "is ";
        if(this._majorConcerns.length>0) t+= "also ";
        t += "a minor point ";
      }
      else{
        t += "are ";
        if(this._majorConcerns.length>0) t+= "also ";
        t += "some minor points ";
      }
      t += "that should be clarified. ";
      if(this._minorConcerns.length==1) t += this._minorConcerns[0].toString()+"\n\n";
      else{
        for(let i=0;i<this._minorConcerns.length;i++){
          t += i+"- "+this._minorConcerns[i].toString()+"\n\n";
        }
        t += "\n\n";
      }
    }

    t += "<Comments for editors>";
    return t;
  }
}

class Mark{
  constructor(criterion,comment){
    this._criterion = criterion;
    this._annotations = [];
    this._comment = comment;
    this._review = null;
    this._suggestedLiterature = [];
  }
  inserAnnotation(annotation){
    this._annotations.push(annotation);
  }
  get annotations(){
    return this._annotations;
  }
  get criterion(){
    return this._criterion;
  }
  get comment(){
    return this._comment;
  }
  set review(review){
    this._review = review;
  }
  get review(){
    return this._review;
  }
  get suggestedLiterature(){
    return this._suggestedLiterature;
  }
  set suggestedLiterature(literature){
    this._suggestedLiterature = literature;
  }
  literatureToString(){
    let literature = this._suggestedLiterature
    literature = literature.concat(...this._annotations.map((e) => {return e.suggestedLiterature}))
    if(literature.length==0) return '';
    let l = ' I would encourage the authors to look at the following papers: ';
    for(let article in literature){
      l += '\n- '+literature[article];
    }
    return l;
  }
}

class MajorConcern extends Mark{
  constructor(criterion,comment){
    super(criterion,comment);
  }
  toString(){
    let t = '';
    switch(this.criterion){
      case "Relevance":
        t += "I was not convinced of the relevance of the problem.";
        break;
      case "Significance":
        t += "I think that the importance of the problem needs to be emphasized.";
        break;
      case "Depth of analysis":
        t += "The paper seems to overlook the ‘why’ and focus too much on the ‘what’.";
        break;
      case "Adoption":
        t += "There is uncertainty about the adoption of the artefact by practitioners.";
        break;
      case "Generative potential":
        t += "The artefact lacks the potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
        break;
      case "Transferability":
        t += "There is no evidence about its generalisability to other domains.";
        break;
      case "Artefact":
        t += "The proposed solution is neither convincing nor even described in a suitable way."
        break;
      case "Novelty":
        t += "The authors need to show more clearly what is original in their solution."
        break;
      case "Evaluation":
        t += "I do have reservations about the evaluation process."
        break;
      case "Solution comparison":
        t += "The authors need to compare their artefact to other extant solutions."
        break;
      case "Behavior explanation":
        t += "There is no clear understanding of the behavior of the artefact."
        break;
      case "Research methods":
        t += "There are a number of issues with the methodology that need to be clarified/addressed."
        break;
      case "Justificatory knowledge":
        t += "I think the authors need to do a better job at grounding the design in existing research."
        break;
      case "Meta-requirements":
        t += "I would like to see more detail about the meta-requirements of the proposed solution."
        break;
      case "Meta-design":
        t += "A bit more detail about the meta-design would be helpful."
        break;
      case "Testable hypotheses":
        t += "The design theory lacks from testable hypotheses."
        break;
      case "Nascent Theory":
        // TODO
        break;
    }
    if(this.comment!=null) t += ' '+this.comment;
    for(let a in this.annotations){
      t += '\n\t*'+this.annotations[a].toString();
    }
    t += '\n'+super.literatureToString()
    return t;
  }
}

class MinorConcern extends Mark{
  constructor(criterion,comment){
    super(criterion,comment);
  }
  existsMajorConcern(){
    return this.review.majorConcerns.find((m) => {return m.criterion==this.criterion})!=null;
  }
  toString(){
    let m = this.existsMajorConcern();
    let t = '';
    if(m){
      t += "I have a more minor point ";
      let connectors = ["with regard to","concerning","regarding","referring to"];
      t += connectors[Math.floor(Math.random()*connectors.length)];
      t += " the ";
      switch(this.criterion){
        case "Relevance":
          t += "relevance of the problem.";
          break;
        case "Significance":
          t += "significance of the problem.";
          break;
        case "Depth of analysis":
          t += "epth of analysis of the problem.";
          break;
        case "Adoption":
          t += "adoption and use of the new artefact by practitioners.";
          break;
        case "Generative potential":
          t += "potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
          break;
        case "Transferability":
          t += "generalisability of the solution to other domains.";
          break;
        case "Artefact":
          t += "artefact."
          break;
        case "Novelty":
          t += "novelty of the artefact."
          break;
        case "Evaluation":
          t += "evaluation of the artefact."
          break;
        case "Solution comparison":
          t += "comparison of the artefact with other extant solutions."
          break;
        case "Behavior explanation":
          t += "behavior of the artefact."
          break;
        case "Research methods":
          t += "use of research methods."
          break;
        case "Justificatory knowledge":
          t += "grounding of the design in existing research."
          break;
        case "Meta-requirements":
          t += "meta-requirements."
          break;
        case "Meta-design":
          t += "meta-design."
          break;
        case "Testable hypotheses":
          t += "testeable hypotheses."
          break;
        case "Nascent Theory":
          // TODO
          break;
      }
    }
    else{
      switch(this.criterion){
        case "Relevance":
          t += "I was not convinced of the relevance of the problem.";
          break;
        case "Significance":
          t += "I think that the importance of the problem needs to be emphasized.";
          break;
        case "Depth of analysis":
          t += "The paper seems to overlook the ‘why’ and focus too much on the ‘what’.";
          break;
        case "Adoption":
          t += "There is uncertainty about the adoption of the artefact by practitioners.";
          break;
        case "Generative potential":
          t += "The artefact lacks the potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
          break;
        case "Transferability":
          t += "There is no evidence about its generalisability to other domains.";
          break;
        case "Artefact":
          t += "The proposed solution is neither convincing nor even described in a suitable way."
          break;
        case "Novelty":
          t += "The authors need to show more clearly what is original in their solution."
          break;
        case "Evaluation":
          t += "I do have reservations about the evaluation process."
          break;
        case "Solution comparison":
          t += "The authors need to compare their artefact to other extant solutions."
          break;
        case "Behavior explanation":
          t += "There is no clear understanding of the behavior of the artefact."
          break;
        case "Research methods":
          t += "There are a number of issues with the methodology that need to be clarified/addressed."
          break;
        case "Justificatory knowledge":
          t += "I think the authors need to do a better job at grounding the design in existing research."
          break;
        case "Meta-requirements":
          t += "I would like to see more detail about the meta-requirements of the proposed solution."
          break;
        case "Meta-design":
          t += "A bit more detail about the meta-design would be helpful."
          break;
        case "Testable hypotheses":
          t += "The design theory lacks from testable hypotheses."
          break;
        case "Nascent Theory":
          // TODO
          break;
      }
    }
    if(this.comment!=null) t += ' '+this.comment;
    for(let a in this.annotations){
      t += '\n\t*'+this.annotations[a].toString();
    }
    t += '\n'+super.literatureToString()
    return t;
  }
}

class Strength extends Mark{
  constructor(criterion,comment){
    super(criterion,comment);
  }
  toString(){
    let t = '';
    switch(this.criterion){
      case "Relevance":
        t += "the topic addressed is relevant and timely.";
        break;
      case "Significance":
        t += "it addresses an important topic.";
        break;
      case "Depth of analysis":
        t += "the paper is well-motivated and properly formulated.";
        break;
      case "Adoption":
        t += "the artefact has been adopted by real practitioners.";
        break;
      case "Generative potential":
        t += "it has the potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
        break;
      case "Transferability":
        t += "the solution can be generalised to other domains.";
        break;
      case "Artefact":
        t += "the proposed solution is clear and convincing."
        break;
      case "Novelty":
        t += "it finds a novel solution."
        break;
      case "Evaluation":
        t += "the evaluation was well conducted."
        break;
      case "Solution comparison":
        t += "the artefact has been compared with extant solutions."
        break;
      case "Behavior explanation":
        t += "there is clear understanding of the behavior of the artefact."
        break;
      case "Research methods":
        t += "research methods have been used rigurously."
        break;
      case "Justificatory knowledge":
        t += "the solution is rooted on existing research."
        break;
      case "Meta-requirements":
        t += "the meta-requirements have been specified."
        break;
      case "Meta-design":
        t += "the meta-design is present."
        break;
      case "Testable hypotheses":
        t += "testable hypotheses have been specified."
        break;
      case "Nascent Theory":
        // TODO
        break;
    }
    if(this.comment!=null) t += ' '+this.comment;
    for(let a in this.annotations){
      t += '\n\t*'+this.annotations[a].toString();
    }
    t += '\n'+super.literatureToString()
    return t;
  }
}

class Annotation {
  constructor(highlightText,page,comment){
    this._highlightText = highlightText;
    this._page = page;
    this._comment = comment;
    this._paragraph = null;
    this._lines = null;
    this._suggestedLiterature = [];
  }
  get highlightText(){
    return this._highlightText;
  }
  get page(){
    return this._page;
  }
  get comment(){
    return this._comment;
  }
  set suggestedLiterature(literature){
    this._suggestedLiterature = literature;
  }
  get suggestedLiterature(){
    return this._suggestedLiterature;
  }
  toString(){
    let t = '';
    if(this._page!=null){
      t += '(Page '+this._page;
      if(this._paragraph!=null) t += " para. "+this._paragraph;
      if(this._lines!=null) t += " lines "+this._lines;
      t += '): ';
    }
    t += '"'+this._highlightText+'". ';
    if(this._comment!=null) t += '\n\t'+this._comment;
    return t;
  }
}

module.exports = {Review,Mark,MajorConcern,MinorConcern,Strength,Annotation};
*/

class Review {
  constructor(){
    this._annotations = []
  }
  insertAnnotation(annotation){
    this._annotations.push(annotation)
  }
  get annotations(){
    return this._annotations
  }
  groupByCriterionInsideLevel (level){
    let that = this
    let groups = []
    let levelAnnotations = this._annotations.filter((e) => {return e.level===level})
    for(let i in levelAnnotations){
      if(groups.find((e) => {return e.annotations[0].criterion===levelAnnotations[i].criterion})!=null) continue;
      groups.push(new AnnotationGroup(levelAnnotations.filter((e) => {return e.criterion===levelAnnotations[i].criterion}),that));
    }
    return groups;
  }
  get strengths(){
    return this.groupByCriterionInsideLevel("Strength")
  }
  get minorConcerns(){
    return this.groupByCriterionInsideLevel("Minor concern")
  }
  get majorConcerns(){
    return this.groupByCriterionInsideLevel("Major concern")
  }
  get typos(){
    return this.annotations.filter((e) => {return e.criterion==="Typos"})
  }
  toString(){
    // Summary of the work
    let t = "<Summarize the work>\n\n";

    // Strengths
    if(this.strengths.length>0) t+= "STRENGTHS:\n\n";
    if(this.strengths.length==1){
      t += "The main strength of this work is that "+this.strengths[0].toString()+"\n\n";
    }
    else if(this.strengths.length>1){
      for(let s in this.strengths){
        t += "- "+this.strengths[s].toString()+"\n\n";
      }
      t += "\n\n";
    }

    // Major concerns
    if(this.majorConcerns.length>0){
      t += "MAJOR CONCERNS:\n\n"
      t += "In the following, I express ";
      if(this.majorConcerns.length>1) t += "some important concerns ";
      else t += "an important concern ";
      t += "I have about the manuscript"
      if(this.majorConcerns.length==1) t += ". "+this.majorConcerns[0].toString()+"\n\n";
      else{
        t += ":\n\n";
        for(let i=0;i<this.majorConcerns.length;i++){
          t += (i+1)+"- "+this.majorConcerns[i].toString()+"\n\n";
        }
        t += "\n\n";
      }
    }

    // Minor concerns
    if(this.minorConcerns.length>0){
      t += "MINOR CONCERNS:\n\n"
      t += "There ";
      if(this.minorConcerns.length==1){
        t += "is ";
        if(this.majorConcerns.length>0) t+= "also ";
        t += "a minor point ";
      }
      else{
        t += "are ";
        if(this.majorConcerns.length>0) t+= "also ";
        t += "some minor points ";
      }
      t += "that should be clarified. ";
      if(this.minorConcerns.length==1) t += this.minorConcerns[0].toString()+"\n\n";
      else{
        for(let i=0;i<this.minorConcerns.length;i++){
          t += i+"- "+this.minorConcerns[i].toString()+"\n\n";
        }
        t += "\n\n";
      }
    }

    // Typos
    if(this.typos.length>0){
      t += "TYPOS:\n\n"
      for(let i=0;i<this.typos.length;i++){
        t += "\t- "
        if(this.typos[i].page!=null) t+= '(Page '+this.typos[i].page+'): '
        t += '"'+this.typos[i].highlightText+'"'
        if(this.typos[i].comment!=null) t+= '\n\t'+this.typos[i].comment
        t += '\n'
      }
    }
    t += "<Comments for editors>";
    return t;
  }
}

class Annotation {
  constructor(id,criterion,level,highlightText,page,comment,suggestedLiterature){
    this._criterion = criterion
    this._level = level
    this._highlightText = highlightText
    this._page = page
    this._comment = comment
    this._suggestedLiterature = suggestedLiterature
    this._id = id
  }
  get criterion(){
    return this._criterion
  }
  get level(){
    return this._level
  }
  get highlightText(){
    return this._highlightText
  }
  get page(){
    return this._page
  }
  get comment(){
    return this._comment
  }
  get suggestedLiterature(){
    return this._suggestedLiterature
  }
  get id(){
    return this._id
  }
}

class AnnotationGroup {
  constructor(annotations,review){
    this._annotations = annotations
    this._review = review
  }
  get annotations(){
    return this._annotations
  }
  toString(){
    let t = ''
    let concernToString = (c) => {
      let str = ''
      switch(c){
        case "Relevance":
          str += "I was not convinced of the relevance of the problem.";
          break;
        case "Significance":
          str += "I think that the importance of the problem needs to be emphasized.";
          break;
        case "Depth of analysis":
          str += "The paper seems to overlook the ‘why’ and focus too much on the ‘what’.";
          break;
        case "Adoption":
          str += "There is uncertainty about the adoption of the artefact by practitioners.";
          break;
        case "Generative potential":
          str += "The artefact lacks the potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
          break;
        case "Transferability":
          str += "There is no evidence about its generalisability to other domains.";
          break;
        case "Artefact":
          str += "The proposed solution is neither convincing nor even described in a suitable way."
          break;
        case "Novelty":
          str += "The authors need to show more clearly what is original in their solution."
          break;
        case "Evaluation":
          str += "I do have reservations about the evaluation process."
          break;
        case "Solution comparison":
          str += "The authors need to compare their artefact to other extant solutions."
          break;
        case "Behavior explanation":
          str += "There is no clear understanding of the behavior of the artefact."
          break;
        case "Research methods":
          str += "There are a number of issues with the methodology that need to be clarified/addressed."
          break;
        case "Justificatory knowledge":
          str += "I think the authors need to do a better job at grounding the design in existing research."
          break;
        case "Meta-requirements":
          str += "I would like to see more detail about the meta-requirements of the proposed solution."
          break;
        case "Meta-design":
          str += "A bit more detail about the meta-design would be helpful."
          break;
        case "Testable hypotheses":
          str += "The design theory lacks from testable hypotheses."
          break;
        case "Nascent Theory":
          // TODO
          break;
        case "Constructs":
          str += 'I would like to see more detail about constructs.'
          break;
        default:
          str += 'The authors need to do a better job as regards '+c.charAt(0).toLowerCase()+c.slice(1)+'.'
          break;
      }
      return str
    }
    switch(this._annotations[0].level){
      case "Strength":
        switch(this._annotations[0].criterion){
          case "Relevance":
            t += "the topic addressed is relevant and timely.";
            break;
          case "Significance":
            t += "it addresses an important topic.";
            break;
          case "Depth of analysis":
            t += "the paper is well-motivated and properly formulated.";
            break;
          case "Adoption":
            t += "the artefact has been adopted by real practitioners.";
            break;
          case "Generative potential":
            t += "it has the potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
            break;
          case "Transferability":
            t += "the solution can be generalised to other domains.";
            break;
          case "Artefact":
            t += "the proposed solution is clear and convincing."
            break;
          case "Novelty":
            t += "it finds a novel solution."
            break;
          case "Evaluation":
            t += "the evaluation was well conducted."
            break;
          case "Solution comparison":
            t += "the artefact has been compared with extant solutions."
            break;
          case "Behavior explanation":
            t += "there is clear understanding of the behavior of the artefact."
            break;
          case "Research methods":
            t += "research methods have been used rigurously."
            break;
          case "Justificatory knowledge":
            t += "the solution is rooted on existing research."
            break;
          case "Meta-requirements":
            t += "the meta-requirements have been specified."
            break;
          case "Meta-design":
            t += "the meta-design is present."
            break;
          case "Testable hypotheses":
            t += "testable hypotheses have been specified."
            break;
          case "Nascent Theory":
            // TODO
            break;
          case "Constructs":
            t += "constructs have been specified."
            break;
          default:
            t += this._annotations[0].criterion+' is/are ok.'
            break;
        }
        break
      case "Minor concern":
        if(this._review.annotations.find((e) => {return e.criterion===this._annotations[0].criterion&&e.level==="Major concern"})!=null){
          t += "I have a more minor point "
          let connectors = ["with regard to","concerning","regarding","referring to"]
          t += connectors[Math.floor(Math.random()*connectors.length)]
          t += " the "
          switch(this._annotations[0].criterion){
            case "Relevance":
              t += "relevance of the problem.";
              break;
            case "Significance":
              t += "significance of the problem.";
              break;
            case "Depth of analysis":
              t += "depth of analysis of the problem.";
              break;
            case "Adoption":
              t += "adoption and use of the new artefact by practitioners.";
              break;
            case "Generative potential":
              t += "potential to inspire further innovation in other new artefacts or new uses of existing artefacts.";
              break;
            case "Transferability":
              t += "generalisability of the solution to other domains.";
              break;
            case "Artefact":
              t += "artefact."
              break;
            case "Novelty":
              t += "novelty of the artefact."
              break;
            case "Evaluation":
              t += "evaluation of the artefact."
              break;
            case "Solution comparison":
              t += "comparison of the artefact with other extant solutions."
              break;
            case "Behavior explanation":
              t += "behavior of the artefact."
              break;
            case "Research methods":
              t += "use of research methods."
              break;
            case "Justificatory knowledge":
              t += "grounding of the design in existing research."
              break;
            case "Meta-requirements":
              t += "meta-requirements."
              break;
            case "Meta-design":
              t += "meta-design."
              break;
            case "Testable hypotheses":
              t += "testeable hypotheses."
              break;
            case "Nascent Theory":
              // TODO
              break;
            case "Constructs":
              t += "constructs."
              break;
            default:
              t += this._annotations[0].criterion+'.'
              break;
          }
        }
        else t += concernToString(this._annotations[0].criterion)
        break
      case "Major concern":
        t += concernToString(this._annotations[0].criterion)
        break
      default:
        break
    }
    for(let i in this._annotations){
      if(this._annotations[i].highlightText===null) continue
      t += '\n\t* '
      if(this._annotations[i].page!==null) t += '(Page '+this._annotations[i].page+'): '
      t += '"'+this._annotations[i].highlightText+'". ';
      if(this._annotations[i].comment!=null) t += '\n\t'+this._annotations[i].comment;
    }
    let literature = [].concat.apply([],this._annotations.map((e) => {return e.suggestedLiterature}))
    if(literature.length>0){
      t += '\n\tI would encourage the authors to look at the following papers: ';
      for(let j in literature){
        t += '\n\t\t- '+literature[j];
      }
    }
    return t
  }
}

module.exports = {Review,Annotation,AnnotationGroup}

