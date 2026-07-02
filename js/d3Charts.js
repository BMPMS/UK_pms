const colors = {
    N: "#00897B",
    NS: "#00897BB3",
    S: "#7E3F8F",
    I: "#6B7280",
    F: "#6B7280",
    Labour: "#E4003B",
    Liberal: "#FAA61A",
    Conservative: "#0087DC",
    Tory: "#0087DCB3",
    Peelite: "#FAA61AB3",
    Whig: "#FAA61AB3",
    W: "#FFFFFF", // White
    Bk: "#111111", // Black
    MidGy: "#A8ADB6",
    Gy: "#E5E7EB" // Light grey
};

const headerMenuHeight = 300;

const measureWidth = (text, fontSize) => {
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${fontSize}px Arial`;
    return context.measureText(text).width;
}

const drawChart = (div, data, width,windowHeight) => {

    const  viewType = window.viewType || 'home';
    let svg = div.select(".chartSvg");
    let chartHeight = windowHeight - headerMenuHeight;

    // append non data dependent elements
    if (svg.empty()) {
        svg = div.append("svg").attr("class","noselect chartSvg");
        svg.append("rect").attr("class","northBackRect");
        svg.append("rect").attr("class","southBackRect");
        const northLabel = svg.append("text").attr("class","northLabel");
        northLabel.append("tspan").attr("class", "northLabelPercent")
        northLabel.append("tspan").attr("class", "northLabelText")
        northLabel.append("tspan").attr("class", "northLabelNorth")

        const southLabel = svg.append("text").attr("class","southLabel");
        southLabel.append("tspan").attr("class", "southLabelPercent")
        southLabel.append("tspan").attr("class", "southLabelText")
        southLabel.append("tspan").attr("class", "southLabelSouth")
        southLabel.append("tspan").attr("class", "southLabelText2")
        southLabel.append("tspan").attr("class", "southLabelElsewhere")
        svg.append("g").attr("class","xAxisTime");

    }

    // size svg
    svg.attr("width",`${width}px`)
        .attr("height",`${chartHeight}px`)

    // key variables
    const {primeMinisters} = data;
    const dotRadius = 19;
    const labelHeight = 30;
    const dotHeight = dotRadius * 2.5;
    const rectExtra = dotHeight * 0.25;
    let margin = {labelTop: dotRadius * 2, label: 140,left: 15, right: 15 ,top: dotRadius * 5, bottom: dotRadius * 3};
    const yearExtent = d3.extent(primeMinisters, (d) => d.midYear);

    // various data manipulations used when defining the chart positions

    // group by minParty (Con, Lab or Lib)
    const byPartyNorth = [
        ...d3.group(
            primeMinisters.filter((f) => f.Location === "N" || f.Location === "NS"),
            (d) =>
                d.minParty
        )
    ]

    const byPartySouth = [
        ...d3.group(
            primeMinisters.filter((f) => !(f.Location === "N" || f.Location === "NS")),
            (d) => d.minParty
        )
    ]

    // the data sorts naturally into 10 or 20 year bins depending on the width
    // mobile view goes vertical so switches back to 10 year bins as we now have space
    const binBig = 30;
    const binThresholdWidth = dotHeight * (binBig + 0.25);
    const binThresholds = width < 800 || (width - margin.left - margin.right) > binThresholdWidth ? 30 : 16;

    // adjust margins for time view
    let timeThresholdWidth = binThresholdWidth;
    if(binThresholds === 16 && viewType === 'byTime') {
        const smallBinThresholdWidth = dotHeight * 16.25;
        margin.left = (width - smallBinThresholdWidth - dotRadius )/2;
        margin.right = (width - smallBinThresholdWidth - dotRadius)/2;
        timeThresholdWidth = smallBinThresholdWidth;
    } else if (viewType === 'byTime') {
        margin.left = (width - binThresholdWidth - dotRadius )/2;
        margin.right = (width - binThresholdWidth - dotRadius)/2;
    }
    // adjusts container width for time view
    const divContainerWidth = viewType === 'byTime' || width < 800? window.innerWidth : timeThresholdWidth;
   // d3.select(".divContainer").style("width",`${divContainerWidth}px`);


    const chartWidth = width - margin.left - margin.right;
    const dotsPerRow = Math.floor(chartWidth/dotHeight) - 1;

    const nodeBinsNorth = d3
        .bin()
        .domain([yearExtent[0] || 0, yearExtent[1] || 0])
        .thresholds(binThresholds)
        .value((d) => d.midYear || 0)(
            primeMinisters.filter((f) => f.Location === "N" || f.Location === "NS")
        )
    const nodeBinsSouth = d3
        .bin()
        .domain([yearExtent[0] || 0, yearExtent[1] || 0])
        .thresholds(binThresholds)
        .value((d) => d.midYear || 0)(
            primeMinisters.filter((f) => !(f.Location === "N" || f.Location === "NS"))
        )

    const byLocation = [
        ...d3.group(primeMinisters, (g) =>
            g.Location === "N" || g.Location === "NS" ? "North" : "Other"
        )
    ]
    const timeBandWidth = (viewType === 'byTime' ? dotHeight : dotHeight/2) * (binThresholds-1);


    const getPartyPositions = () => {
        const padding = dotRadius;
        const partyType = byPartyNorth.map((m) => m[0]);
        const partyMax = partyType.map((m) => ({
            party: m,
            max: Math.max(
                byPartyNorth.find((f) => f[0] === m)[1].length,
                byPartySouth.find((f) => f[0] === m)[1].length
            )
        }));
        const maxTotal = d3.sum(partyMax, (s) => s.max);

        let propAcc = 0;
        let totalWidth =
            width - margin.left - margin.right - padding * partyType.length;
        if(width < 800){
            totalWidth = timeBandWidth;
        }
        return partyMax.reduce((acc, entry) => {
            const prop = entry.max / maxTotal;
            const partyWidth = totalWidth * prop;
            acc.push({
                party: entry.party,
                partyWidth,
                partyX: propAcc,
                labelX: propAcc + partyWidth / 2,
                prop
            });
            propAcc += partyWidth + padding;
            return acc;
        }, []);
    }
    const partyPositions = getPartyPositions();

    const pmPositioned = byLocation.reduce((acc, entry) => {
        const isSouth = entry[0] === "Other";
        const matchingBinArray = isSouth ? nodeBinsSouth : nodeBinsNorth;
        const byParty = isSouth ? byPartySouth : byPartyNorth;
        const yMultiple = isSouth ? dotHeight : -dotHeight;

        entry[1].forEach((e, i) => {
            const matchingBin = matchingBinArray.find((f) =>
                f.some((s) => s.photoName === e.photoName)
            );
            const matchingBinIndex = matchingBinArray.findIndex(
                (f) => f.x0 === matchingBin.x0
            );
            const binValuesIndex =
                matchingBin.findIndex((f) => f.photoName === e.photoName) - 1;

            const partyPosition = partyPositions.find((f) => f.party === e.minParty);
            const partyGroup = byParty.find((f) => f[0] === e.minParty);
            const partyIndex = partyGroup[1].findIndex(
                (f) => f.photoName === e.photoName
            );
            const partyDotsPerRow = Math.floor(partyPosition.partyWidth / (dotRadius * 2.5))
            acc.push({
                homePos: {
                    x:  (i % dotsPerRow) * dotHeight,
                    y:  Math.floor(i / dotsPerRow) * dotHeight,
                    xCount: (i % dotsPerRow) + 1,
                    row: Math.floor(i / dotsPerRow) + 1
                },
                timePos: {
                    x:  dotHeight * matchingBinIndex,
                    y:  yMultiple * (binValuesIndex + 1),
                    xCount: matchingBinIndex + 1,
                    row: binValuesIndex + 1
                },
                timePosSmall: {
                    y:  dotHeight * matchingBinIndex,
                    x:  yMultiple * (binValuesIndex + 1),
                    row: matchingBinIndex + 1,
                    xCount: binValuesIndex + 1
                },
                partyPos: {
                    x:
                        partyPosition.partyX +
                        (partyIndex % partyDotsPerRow) * dotHeight,
                    y: Math.floor(partyIndex / partyDotsPerRow) * yMultiple,
                    xCount: partyIndex + 1,
                    row: Math.floor(partyIndex / partyDotsPerRow) + 1
                },
                partyPosSmall: {
                    y:
                        partyPosition.partyX +
                        (partyIndex % partyDotsPerRow) * dotHeight,
                    x: Math.floor(partyIndex / partyDotsPerRow) * yMultiple,
                    row: partyIndex + 1,
                    xCount: Math.floor(partyIndex / partyDotsPerRow) + 1
                },
                r: dotRadius,
                photo: `images/${e.photoName}`,
                photoName: e.photoName,
                data: e,
                isSouth
            });
        });
        return acc;
    }, [])

    const getPos = (d) => {
        if( viewType === "home") return d.homePos;
        if(viewType === "byTime") {
            if(width < 800) return d.timePosSmall;
            return d.timePos;
        }
        if(width < 800) return d.partyPosSmall;
        return d.partyPos
    };

    const getMaxNorth = () => {
        if(viewType === 'byTime') return d3.max(nodeBinsNorth, (d) => d.length);
       // if(viewType === 'byParty') return d3.max(byPartyNorth, (d) => d[1].length);
        return d3.max(pmPositioned.filter((f) => !f.isSouth), (d) => getPos(d).row)
    }

    const getMaxSouth = () => {
        if(viewType === 'byTime') return d3.max(nodeBinsSouth, (d) => d.length);
      //  if(viewType === 'byParty') return d3.max(byPartySouth, (d) => d[1].length);
        return d3.max(pmPositioned.filter((f) => f.isSouth), (d) => getPos(d).row)
    }

    const northHeight = rectExtra +  getMaxNorth() * dotHeight;
    const southStart = northHeight + (labelHeight * (viewType === 'byTime' ? 2 : 3));
    const southHeight = rectExtra + getMaxSouth() * dotHeight;

    const timeSmallAxisWidth = labelHeight * 1.5
    const timeWidth = (chartWidth - timeSmallAxisWidth)/2;
    const timeSouthLeft = timeWidth + timeSmallAxisWidth;
    const isTimeSmall = (viewType === 'byTime' || viewType === 'byParty') && width < 800

    const newChartHeight = southStart + southHeight + margin.top + margin.bottom;
    if(newChartHeight > chartHeight){
        chartHeight = newChartHeight;
    }
    svg.attr("height", `${chartHeight}px`);
    if(isTimeSmall) {
        svg.attr("height", `${timeBandWidth + margin.top + margin.bottom}px`);
    }

   const totalNorth = primeMinisters.filter((f) => f.Location === "N" || f.Location === "NS");
   const northProp = totalNorth.length/primeMinisters.length;
   const southProp = 1 - northProp;
   const fontSizeBig = width < 800 ? 18 : 24;
   const fontSizeSmall = width < 800 ? 14 : 16;

   const northPercentVal = d3.format(".0%")(northProp);

   const bornText = width < 600 ? " " : " born in the ";
   const northWidth = measureWidth(northPercentVal, fontSizeBig)
       + measureWidth(bornText, fontSizeSmall)
       + measureWidth("North", fontSizeBig);

    svg.select(".northLabel")
        .style("dominant-baseline","baseline")
        .attr("x", isTimeSmall ? timeWidth + rectExtra - northWidth: (width - northWidth)/2)
        .attr("y",margin.labelTop + labelHeight  - 6)
        .attr("fill",colors.MidGy)

    svg.select(".northLabelPercent")
        .attr("fill",colors.Bk)
        .attr("font-size",fontSizeBig)
        .text(northPercentVal);

    svg.select(".northLabelText")
        .attr("font-size",fontSizeSmall)
        .text(bornText);

    svg.select(".northLabelNorth")
        .attr("text-anchor","start")
        .attr("font-size",fontSizeBig)
        .attr("fill",colors.N)
        .text("North");

    svg.select(".northBackRect")
        .attr("fill",colors.N)
        .attr("fill-opacity",0.1)
        .attr("rx",5)
        .attr("ry",5)
        .attr("x", margin.left )
        .attr("y", margin.labelTop + labelHeight)
        .attr("width",isTimeSmall ? timeWidth : chartWidth)
        .attr("height", isTimeSmall ? timeBandWidth + dotHeight : northHeight);

    const southPercentVal = d3.format(".0%")(southProp);
    const southWidth = measureWidth(southPercentVal, fontSizeBig)
        + measureWidth(bornText, fontSizeSmall)
        + measureWidth("South", fontSizeBig)
    + measureWidth(" or ", fontSizeSmall)
        + measureWidth("Elsewhere", fontSizeBig);

    svg.select(".southLabel")
        .style("dominant-baseline","baseline")
        .attr("x",isTimeSmall ? timeSouthLeft + rectExtra :(width - southWidth)/2 )
        .attr("y", margin.labelTop + (isTimeSmall ? labelHeight - 6 : southStart - 6 +
            (viewType === "byTime" || viewType === 'byParty'? southHeight + labelHeight : 0)))
        .attr("fill",colors.MidGy)


    svg.select(".southLabelPercent")
        .attr("font-size",fontSizeBig)
        .attr("fill",colors.Bk)
        .text(northPercentVal);

    svg.select(".southLabelText")
        .attr("font-size",fontSizeSmall)
        .text(bornText);

    svg.select(".southLabelSouth")
        .attr("text-anchor","start")
        .attr("font-size",fontSizeBig)
        .attr("fill",colors.S)
        .text("South");

    svg.select(".southLabelText2")
        .attr("font-size",fontSizeSmall)
        .text(" or ");

    svg.select(".southLabelElsewhere")
        .attr("text-anchor","start")
        .attr("font-size",fontSizeBig)
        .attr("fill",colors.I)
        .text("Elsewhere");

    svg.select(".southBackRect")
        .attr("fill",colors.S)
        .attr("fill-opacity",0.1)
        .attr("rx",5)
        .attr("ry",5)
        .attr("x", margin.left + (isTimeSmall ? timeSouthLeft : 0))
        .attr("y", margin.labelTop + (isTimeSmall ? labelHeight: southStart))
        .attr("width", isTimeSmall ? timeWidth : chartWidth)
        .attr("height", isTimeSmall ? timeBandWidth + dotHeight : southHeight);

    const circleRowNorth = [...d3.rollup(
        pmPositioned.filter((f) => !f.isSouth),
        (v) => v.length,
        (g) => getPos(g).row
    )]
    const circleRowSouth = [...d3.rollup(
        pmPositioned.filter((f) => f.isSouth),
        (v) => v.length,
        (g) => getPos(g).row
    )];

    pmPositioned.map((m) => {
        const position = getPos(m);
        const circleRow = m.isSouth ? circleRowSouth : circleRowNorth;
        const rowCircles = circleRow.find((f) => f[0] === position.row);
        const xMargin = chartWidth  -((rowCircles[1] - 1) * dotHeight);
        let extraX = xMargin/2;
         if (viewType === "byTime" || viewType === "byParty") {
            extraX = dotHeight * 0.75;
        }
        m.extraX = extraX;
    })

    const xScaleTimeBands = nodeBinsNorth.map((m,i) => i);

    const xAxisTime = svg.select(".xAxisTime");
    const timeXScale = d3.scalePoint().padding(0).domain(xScaleTimeBands).range([0, timeBandWidth]);

    xAxisTime
        .attr("display", viewType === "byTime" ? "block" : "none")
        .call(d3[width < 800 ? 'axisLeft' : 'axisBottom'](timeXScale).tickSizeOuter(0).tickValues(xScaleTimeBands))
        .attr(
            "transform",
            `translate(${width < 800 ? width/2 : margin.left + dotRadius  * 1.9},${
               width < 800 ? margin.top :  southStart - labelHeight + margin.labelTop
            })`
        );

    const binIncrement = binThresholds === 30 ? 10 : 20;
    xAxisTime.selectAll("line").attr("display", "none");
    xAxisTime.selectAll("path").attr("display", "none");
    xAxisTime.selectAll("text")
        .attr("fill", colors.MidGy)
        .style("text-anchor", "middle")
        .attr("x",0)
        .attr("font-size", 16)
        .text((d) => 1720 + (binIncrement * d));


    const partyLabelGroup = svg
        .selectAll(".partyLabelGroup")
        .data(viewType === 'byParty' ? byPartySouth.map((m) => m[0]) : [])
        .join((group) => {
            const enter = group.append("g").attr("class", "partyLabelGroup");
            enter.append("rect").attr("class", "partyLabelRect");
            enter.append("text").attr("class", "partyLabel");

            return enter;
        });

    partyLabelGroup.attr("transform", (d) => {
        const partyPos = partyPositions.find((f) => f.party === d);
        if(viewType === "byParty") {
            if(width < 800){
                return `translate(${margin.left + timeWidth + labelHeight * 0.7},${partyPos.labelX + margin.labelTop + labelHeight}) rotate(90)`;
            }
            const yPos = southStart + fontSizeBig/2;
            return `translate(${partyPos.labelX + margin.left + rectExtra},${yPos})`;
        }
        // only applies to byParty
        return ""
    })

    partyLabelGroup.select(".partyLabel")
        .attr("font-size",fontSizeBig)
        .attr("fill",(d) => colors[d])
        .style("dominant-baseline","middle")
        .attr("text-anchor","middle")
        .text((d) => d)

    partyLabelGroup.select(".partyLabelRect")
        .attr("font-size",fontSizeBig)
        .attr("fill",(d) => colors[d])
        .attr("fill-opacity",0.1)
        .attr("rx",4)
        .attr("ry",4)
        .attr("height", labelHeight)
        .attr("width",(d) => {
            const partyPos = partyPositions.find((f) => f.party === d);
            return partyPos.partyWidth;
        })
        .attr("x",(d) => {
            const partyPos = partyPositions.find((f) => f.party === d);
            return -partyPos.partyWidth/2;
        })
        .attr("y", -labelHeight * 0.55)
        .style("dominant-baseline","middle")
        .attr("text-anchor","middle")
        .text((d) => d)


    const teamGroup = svg
        .selectAll(".teamGroup")
        .data(pmPositioned)
        .join((group) => {
            const enter = group.append("g").attr("class", "teamGroup");
            enter.append("circle").attr("class", "teamCircle");
            enter.append("circle").attr("class", "teamCircleBackground");
            const defs = enter.append("defs");
            defs
                .append("pattern")
                .attr("class", "nodePattern")
                .append("svg:image")
                .attr("class", "patternImage");

            return enter;
        });

    const getTransform = (d) => {
        const xPos =  margin.left + getPos(d).x + d.extraX;
        const southExtra = southStart - dotRadius - rectExtra;
        const viewExtra = () => {
            if(viewType === 'byTime' || 'byParty') return northHeight - dotHeight - rectExtra;
            return 0;
        }
        const yPos =  margin.top +
            getPos(d).y
            + (d.isSouth ? southExtra: viewExtra())
        if(!isTimeSmall) return `translate(${xPos},${yPos})`
        const smallXPos =  width/2 + getPos(d).x + (d.isSouth ? dotHeight : -dotHeight);
        const smallYPos = margin.labelTop + getPos(d).y + labelHeight + dotRadius + rectExtra/2;
        return `translate(${smallXPos},${smallYPos})`;

    }
    teamGroup.attr(
        "transform",getTransform);

    teamGroup
        .select(".nodePattern")
        .attr("id", (d, i) => `pmImage${i}`)
        .attr("width", 1)
        .attr("height", 1);

    teamGroup
        .select(".patternImage")
        .attr("xlink:href", (d) => d.photo)
        .attr("height", dotRadius * 2)
        .attr("width", dotRadius * 2);

    teamGroup
        .select(".teamCircleBackground")
        .attr("id","chart")
        .attr("pointer-events", "none")
        .attr("r", dotRadius + 2)
        .attr("fill", "transparent")
        .attr("stroke", (d) => colors[d.data["Political Party"]])
        .style("stroke-width", 6)
        .style("stroke-opacity", 0)


    teamGroup
        .select(".teamCircle")
        .attr("r", dotRadius)
        .attr("fill", (d, i) => `url(#pmImage${i})`)
        .attr("stroke-width", 3)
        .attr("stroke", (d) => colors[d.data["Political Party"]])
        .on("mousemove",(event,d) => {
            const highlight = d.data.Location === "N" || d.data.Location === "NS" ? "highlightNorth" : "highlightSouth";
            d3.select(".northLabel").attr("opacity", highlight === "highlightNorth" ? 1 : 0.2);
            d3.select(".southLabel").attr("opacity", highlight === "highlightSouth" ? 1 : 0.2);
            let tooltipText = `<span class='highlightBlack'>${d.data["Prime Minister"]}</span><br>`;
            tooltipText += `born: <span class='${highlight}'> ${d.data.Birthplace}</span><br>`
            tooltipText += `<span style="color:${colors[d.data["Political Party"]]}">${d.data["Political Party"]}</span><br>`;
            tooltipText += `from ${new Date(d.data["Term Start"]).getFullYear()} to ${new Date(d.data["Term End"]).getFullYear()}<br>`;
            if(d.data.terms > 1){
                tooltipText += `over ${d.data.terms} terms`;

            }
            d3.select(".chartTooltip")
                .style("left", `${event.pageX + dotRadius}px`)
                .style("top", `${event.pageY - 12}px`)
                .style("visibility", "visible")
                .html(tooltipText);
        })
        .on("mouseover", (event, d) => {
            d3.selectAll(".teamCircleBackground#map")
                .classed("pulse",(c) => c.photoName === d.photoName)
            d3.selectAll(".teamCircle")
                .attr("opacity",(c) => c.photoName === d.photoName ? 1 : 0.3);

        })
        .on("mouseout", () => {
            d3.select(".northLabel").attr("opacity",1);
            d3.select(".southLabel").attr("opacity",1)
            d3.selectAll(".teamCircleBackground").classed("pulse",false);
            d3.selectAll(".teamCircle").attr("opacity",1);
            d3.select(".chartTooltip").style("visibility", "hidden");
        });;



}
const drawMap = (div, data, width, height) => {

    let svg = div.select(".mapSvg");

    if (svg.empty()) {
        svg = div.append("svg").attr("class","noselect mapSvg");
         svg.append("g").attr("class","mapGroup");
        svg.append("line").attr("class","dividerLine");
    }

    const mapGroup = svg.select(".mapGroup");

    svg.attr("width",`${width}px`)
        .attr("height",`${height}px`);

    const {primeMinisters, ukIrelandAll} = data;
    const padding = 10;
    const mapHeight = height - (padding * 2);
    const mapWidth = 5 * (mapHeight/6);
    const sideMargin = (width - mapWidth)/2;

    const projection = d3
        .geoMercator()
        .fitSize([mapWidth, mapHeight], ukIrelandAll);

    const circleRadius = 2;

    let furtherX = 10 + circleRadius;

    const pmData = primeMinisters.reduce((acc, entry) => {
        if (entry.Location !== "F") {
            entry.centroid = projection([
                entry["Birth Longitude"],
                entry["Birth Latitude"]
            ]);
        } else {
            entry.centroid = [furtherX, 10 + circleRadius];
            furtherX += circleRadius * 3;
        }
        acc.push(entry);
        return acc;
    }, []);


    const path = d3.geoPath(projection);

    const continentGroup = mapGroup
        .selectAll(".continentGroup")
        .data(ukIrelandAll.features)
        .join((group) => {
            const enter = group.append("g").attr("class", "continentGroup");
            enter.append("path").attr("class", "continentPath");
            return enter;
        });

    continentGroup.attr("transform",`translate(${sideMargin},${padding})`)

    continentGroup
        .select(".continentPath")
        .attr("d", path)
        .style("stroke-linejoin", "round")
        .style("stroke-linecap", "round")
        .attr("fill", colors.Gy);

    const teamGroup = mapGroup
        .selectAll(".teamGroup")
        .data(pmData)
        .join((group) => {
            const enter = group.append("g").attr("class", "teamGroup");
            enter.append("circle").attr("class", "teamCircle");
            enter.append("circle").attr("class", "teamCircleBackground");

            const defs = enter.append("defs");
            defs
                .append("pattern")
                .attr("class", "nodePattern")
                .append("svg:image")
                .attr("class", "patternImage");

            return enter;
        });

    teamGroup
        .select(".nodePattern")
        .attr("id", (d) => `countryImage${d.code}`)
        .attr("width", 1)
        .attr("height", 1);

    teamGroup
        .select(".patternImage")
        .attr(
            "xlink:href",
            (d) => `https://hatscripts.github.io/circle-flags/flags/${d.flagCode}.svg`
        )
        .attr("height", circleRadius * 2)
        .attr("width", circleRadius * 2);

    teamGroup
        .select(".teamCircleBackground")
        .attr("id","map")
        .attr("pointer-events", "none")
        .attr("r", circleRadius)
        .attr("fill", "transparent")
        .attr("stroke", (d) => colors[d.Location])
        .style("stroke-width", 4)
        .style("stroke-opacity", 0)


    teamGroup
        .select(".teamCircle")
        .attr("r", circleRadius)
        .attr("fill", (d) => colors[d.Location])
        .style("stroke-width", 0)
        .on("mouseover", (event, d) => {
            d3.selectAll(".teamCircleBackground#chart")
                .classed("pulse",(c) => c.photoName === d.photoName);
            d3.selectAll(".teamCircle")
                .attr("opacity",(c) => c.photoName === d.photoName ? 1 : 0.3);
            const highlight = d.Location === "N" || d.Location === "NS" ? "highlightNorth" : "highlightSouth";
            d3.select(".northLabel").attr("opacity", highlight === "highlightNorth" ? 1 : 0.2);
            d3.select(".southLabel").attr("opacity", highlight === "highlightSouth" ? 1 : 0.2);
            d3.select(".chartTooltip")
                .style("left", `${event.pageX -130}px`)
                .style("top", `${event.pageY}px`)
                .style("visibility", "visible")
                .html(`<span class='highlightBlack'>${d["Prime Minister"]}</span> born in <span class='${highlight}'> ${d.Birthplace}</span>`);

        })
        .on("mouseout", () => {
            d3.select(".northLabel").attr("opacity", 1);
            d3.select(".southLabel").attr("opacity", 1);

            d3.selectAll(".teamCircle").attr("opacity",1);
            d3.selectAll(".teamCircleBackground").classed("pulse",false);
            d3.select(".chartTooltip").style("visibility", "hidden");
        });

    const divide = [
        [-3.2, 52.35],
        [1.3, 53.1]
    ]
    const divide1Centroid = projection(divide[0]);
    const divide2Centroid = projection(divide[1]);

    svg
        .select(".dividerLine")
        .attr("x1", divide1Centroid[0] + sideMargin)
        .attr("x2", divide2Centroid[0] + sideMargin)
        .attr("y1", divide1Centroid[1] + padding)
        .attr("y2", divide2Centroid[1] + padding)
        .attr("stroke-width", 1)
        .attr("stroke", "#484848");

    // simulation to move region circles into place
    const simulation = d3
        .forceSimulation()
        .alphaDecay(0.1)
        .force("x", d3.forceX((d) => d.centroid[0]).strength(0.4))
        .force("y", d3.forceY((d) => d.centroid[1]).strength(0.4))
        .force(
            "collide",
            d3
                .forceCollide()
                .radius(circleRadius * 1.05)
                .strength(1)
        );
    simulation.stop();
    simulation.nodes(pmData);
    simulation.tick(300); // instead of running simulation on tick, skip to tick 300 so no jittering

    // transform group
    teamGroup.attr("transform", (d) => `translate(${d.x + sideMargin},${d.y + padding})`);



}

